import {
  Injectable,
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { LRUCache } from 'lru-cache';
import { mapYtDlpToApi } from './video.mapper';
import { canonicalizeUrl } from './url';

const TIMEOUT_MS = 25000;
const MAX_OUTPUT = 8 * 1024 * 1024;

/** Run a system-installed yt-dlp without a shell, bounded in time and output. */
export function extract(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.YT_DLP_PATH || 'yt-dlp',
      [
        '--ignore-config',
        '--no-playlist',
        '--dump-single-json',
        '--no-warnings',
        '--js-runtimes',
        'node',
        '--socket-timeout',
        '5',
        '--',
        url,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    const decoder = new StringDecoder('utf8');
    let bytes = 0;
    let timedOut = false;
    let tooLarge = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) {
        tooLarge = true;
        child.kill('SIGKILL');
      } else stdout += decoder.write(chunk);
    });
    // Drain stderr without returning it to the client or retaining unbounded data.
    child.stderr.resume();
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut)
        return reject(new GatewayTimeoutException('Video provider timed out'));
      if (tooLarge || code !== 0) return reject(new Error('yt-dlp failed'));
      try {
        resolve(JSON.parse(stdout + decoder.end()) as unknown);
      } catch {
        reject(new Error('Invalid yt-dlp output'));
      }
    });
  });
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly cache = new LRUCache<
    string,
    ReturnType<typeof mapYtDlpToApi>
  >({ max: 200, ttl: 60000 });
  private readonly inflight = new Map<
    string,
    Promise<ReturnType<typeof mapYtDlpToApi>>
  >();
  private active = 0;

  async getInfo(input: unknown) {
    const url = canonicalizeUrl(input);
    const cached = this.cache.get(url);
    if (cached) return cached;
    const pending = this.inflight.get(url);
    if (pending) return pending;
    if (this.active >= 4)
      throw new ServiceUnavailableException('Video service is busy');
    this.active++;
    const work = this.fetchInfo(url);
    this.inflight.set(url, work);
    try {
      return await work;
    } finally {
      this.active--;
      this.inflight.delete(url);
    }
  }

  private async fetchInfo(url: string) {
    try {
      const result = mapYtDlpToApi(await extract(url));
      const expirations = [
        result.videos.expiration,
        result.audios.expiration,
        result.subtitles.expiration,
      ].filter((value): value is number => value !== null);
      const ttl = expirations.length
        ? Math.min(60000, Math.min(...expirations) * 1000 - Date.now() - 5000)
        : 60000;
      if (ttl > 0) this.cache.set(url, result, { ttl });
      return result;
    } catch (error) {
      if (error instanceof GatewayTimeoutException) throw error;
      this.logger.error(
        'Video extraction failed',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new BadGatewayException(
        'Video provider could not retrieve this video',
      );
    }
  }
}

/** Bounded, process-local rate limiting, not a distributed security boundary. */
@Injectable()
export class RateLimiter {
  private readonly clients = new LRUCache<
    string,
    { count: number; until: number }
  >({ max: 10000, ttl: 60000 });
  check(ip: string) {
    const now = Date.now();
    let entry = this.clients.get(ip);
    if (!entry || entry.until <= now) {
      entry = { count: 0, until: now + 60000 };
      this.clients.set(ip, entry);
    }
    if (++entry.count > 30)
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
}
