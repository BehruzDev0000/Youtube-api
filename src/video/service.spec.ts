import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VideoService } from './video.service';

describe('extractor concurrency', () => {
  let dir: string;
  let counter: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'video-concurrency-'));
    counter = join(dir, 'calls');
    const bin = join(dir, 'yt-dlp');
    writeFileSync(
      bin,
      `#!/usr/bin/env node\nrequire('fs').appendFileSync(${JSON.stringify(counter)}, 'x'); setTimeout(() => console.log(JSON.stringify({id: process.argv.at(-1).split('v=')[1],formats:[]})), 400);`,
      { mode: 0o755 },
    );
    process.env.YT_DLP_PATH = bin;
  });
  afterEach(() => {
    delete process.env.YT_DLP_PATH;
    rmSync(dir, { recursive: true, force: true });
  });
  it('deduplicates simultaneous requests and caches canonical URLs', async () => {
    const service = new VideoService();
    const [a, b] = await Promise.all([
      service.getInfo('https://youtu.be/G33j5Qi4rE8'),
      service.getInfo('https://youtube.com/watch?v=G33j5Qi4rE8'),
    ]);
    expect(a.id).toBe(b.id);
    await service.getInfo('https://youtu.be/G33j5Qi4rE8');
    expect(readFileSync(counter, 'utf8')).toBe('x');
  });
  it('rejects work beyond the concurrency limit', async () => {
    const service = new VideoService();
    const active = [0, 1, 2, 3].map((i) =>
      service.getInfo(`https://youtu.be/AAAAAAAAAA${i}`),
    );
    await expect(
      service.getInfo('https://youtu.be/AAAAAAAAAA4'),
    ).rejects.toMatchObject({ status: 503 });
    await Promise.all(active);
    expect(readFileSync(counter, 'utf8')).toHaveLength(4);
  });
});

describe('extractor deadline', () => {
  it('terminates a stalled extractor', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-timeout-'));
    const bin = join(dir, 'yt-dlp');
    writeFileSync(bin, '#!/usr/bin/env node\nsetTimeout(() => {}, 60000);\n', {
      mode: 0o755,
    });
    process.env.YT_DLP_PATH = bin;
    try {
      await expect(
        new VideoService().getInfo('https://youtu.be/G33j5Qi4rE8'),
      ).rejects.toMatchObject({ status: 504 });
    } finally {
      delete process.env.YT_DLP_PATH;
      rmSync(dir, { recursive: true, force: true });
    }
  }, 32000);
});
