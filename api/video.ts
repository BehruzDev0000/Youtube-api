import type { IncomingMessage, ServerResponse } from 'node:http';
import { canonicalizeUrl } from '../src/video/url';

// Vercel's Node runtime may parse the request body before invoking the handler.
type Request = IncomingMessage & { body?: unknown };
const counts = new Map<string, { count: number; until: number }>();
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const respond = (status: number, message: string) => {
    res.statusCode = status;
    res.end(JSON.stringify({ statusCode: status, message }));
  };
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'POST')
    return respond(405, 'Method not allowed');
  // Per-instance best effort; enforce a distributed limit at the edge for production.
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = counts.get(ip);
  if (!entry || entry.until <= now) {
    entry = { count: 0, until: now + 60000 };
    if (counts.size >= 10000) counts.clear();
    counts.set(ip, entry);
  }
  if (++entry.count > 30) return respond(429, 'Too many requests');
  let input: unknown;
  if (req.method === 'GET')
    input = new URL(req.url || '/', 'https://localhost').searchParams.get(
      'url',
    );
  else {
    let body = req.body;
    if (body === undefined) {
      let text = '';
      for await (const chunk of req) {
        text += String(chunk);
        if (text.length > 16384) return respond(413, 'Request too large');
      }
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        return respond(400, 'Invalid JSON body');
      }
    }
    input =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { url?: unknown }).url
        : undefined;
  }
  let url: string;
  try {
    url = canonicalizeUrl(input);
  } catch {
    return respond(400, 'A valid YouTube video URL is required');
  }
  const worker = process.env.WORKER_URL;
  const secret = process.env.WORKER_SECRET;
  if (!worker || !secret) return respond(503, 'Video worker is not configured');
  try {
    const target = new URL(worker);
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.search ||
      target.hash
    )
      throw new Error('Invalid worker URL');
    target.pathname = '/api/video';
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': secret,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(28000),
      redirect: 'error',
    });
    const text = await response.text();
    if (text.length > 8 * 1024 * 1024)
      return respond(502, 'Video worker returned an oversized response');
    // Do not forward worker diagnostics or untrusted headers.
    if (!response.ok)
      return respond(
        response.status === 429
          ? 429
          : response.status === 504
            ? 504
            : response.status === 503
              ? 503
              : 502,
        'Video worker could not retrieve this video',
      );
    try {
      JSON.parse(text);
    } catch {
      return respond(502, 'Invalid video worker response');
    }
    res.statusCode = 200;
    return res.end(text);
  } catch {
    return respond(502, 'Video worker unavailable');
  }
}
