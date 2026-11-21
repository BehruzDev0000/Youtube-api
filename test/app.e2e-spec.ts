import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppModule } from '../src/app.module';

describe('Video API (Fastify e2e)', () => {
  let app: NestFastifyApplication;
  let dir: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'video-test-'));
    const bin = join(dir, 'yt-dlp');
    writeFileSync(
      bin,
      `#!/usr/bin/env node\nconst url=process.argv.at(-1); if(url.includes('FAILURE0000')) { console.error('private diagnostics'); process.exit(1); } console.log(JSON.stringify({id: url.split('v=')[1], title:'Fixture', formats:[]}));\n`,
      { mode: 0o755 },
    );
    process.env.YT_DLP_PATH = bin;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app.close();
    delete process.env.YT_DLP_PATH;
    rmSync(dir, { recursive: true, force: true });
  });
  it('handles GET using the extractor', async () => {
    const res = await app.inject({
      method: 'GET',
      url:
        '/api/video?url=' + encodeURIComponent('https://youtu.be/G33j5Qi4rE8'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 'G33j5Qi4rE8', title: 'Fixture' });
  });
  it('handles POST with a canonicalized URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/video',
      payload: { url: 'https://www.youtube.com/watch?v=G33j5Qi4rE8' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ id: 'G33j5Qi4rE8' });
  });
  it.each([
    {},
    { url: 42 },
    { url: ['https://youtu.be/G33j5Qi4rE8'] },
    { url: 'https://youtu.be/G33j5Qi4rE8?list=PLx' },
    { url: 'https://example.com' },
  ])('rejects invalid POST %p', async (payload) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/video',
      payload,
    });
    expect(res.statusCode).toBe(400);
  });
  it('rejects absent bodies and query', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/api/video' })).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ method: 'GET', url: '/api/video' })).statusCode,
    ).toBe(400);
  });
  it('sanitizes extractor errors', async () => {
    const res = await app.inject({
      method: 'GET',
      url:
        '/api/video?url=' + encodeURIComponent('https://youtu.be/FAILURE0000'),
    });
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain('private diagnostics');
  });
});
