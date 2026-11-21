import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import handler from '../api/video';

describe('Vercel proxy HTTP integration', () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
  it('rejects invalid input before contacting a worker', async () => {
    const response = await fetch(
      `${base}/api/video?url=${encodeURIComponent('https://youtu.be/G33j5Qi4rE8?list=123')}`,
    );
    expect(response.status).toBe(400);
  });
  it('reports missing worker configuration rather than claiming success', async () => {
    const response = await fetch(`${base}/api/video`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtu.be/G33j5Qi4rE8' }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: 'Video worker is not configured',
    });
  });
});
