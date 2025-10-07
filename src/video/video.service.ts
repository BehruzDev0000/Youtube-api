
import { Injectable, BadRequestException } from '@nestjs/common';
import ytdlp from 'yt-dlp-exec';
import { LRUCache } from 'lru-cache';
import { mapYtDlpToApi } from './video.mapper';

const cache = new LRUCache<string, any>({
  max: 200,            
  ttl: 1000 * 60 * 10,
});

@Injectable()
export class VideoService {
  async getInfo(url: string) {
    if (!url || !/^https?:\/\/(www\.)?youtube\.com\/watch\?v=|^https?:\/\/youtu\.be\//i.test(url)) {
      throw new BadRequestException('Yaroqli YouTube video URL kiriting');
    }

    const key = `yt:${url}`;
    const cached = cache.get(key);
    if (cached) return cached;

    let info: any;
    try {
      info = await ytdlp(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: false,
        youtubeSkipDashManifest: false, 
        socketTimeout: 2,
      }) as any;
    } catch (e: any) {
      throw new BadRequestException(`yt-dlp xatosi: ${e?.stderr || e?.message || e}`);
    }

    const mapped = mapYtDlpToApi(info);
    cache.set(key, mapped);
    return mapped;
  }
}
