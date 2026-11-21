# YouTube video information API

NestJS/Fastify worker and an optional Vercel HTTP proxy. Both expose `GET /api/video?url=...` and `POST /api/video` with `{ "url": "..." }`. The worker uses yt-dlp to retrieve public video metadata; no video is downloaded. YouTube may block datacenter IPs, require authentication, or change its extraction requirements.

## Run locally

Requirements: Node.js 20 or later, and a current `yt-dlp` executable on `PATH` (or set `YT_DLP_PATH` to its absolute path). For example, install yt-dlp using its official instructions; Python and/or an external JavaScript runtime may be required for current YouTube extraction. Keep yt-dlp updated.

```sh
npm ci
npm run build
npm run start:prod
curl --get 'http://localhost:3003/api/video' --data-urlencode 'url=https://youtu.be/G33j5Qi4rE8'
curl -X POST 'http://localhost:3003/api/video' -H 'content-type: application/json' -d '{"url":"https://youtu.be/G33j5Qi4rE8"}'
```

Set `PORT` to override 3003. Only individual `youtube.com/watch?v=...` and `youtu.be/...` URLs with an 11-character ID are accepted; playlist parameters are rejected. Tracking parameters are discarded. Direct worker POST currently returns 201; the Vercel proxy normalizes successful responses to 200. Validation errors return 400, overload returns 429/503, extractor failures 502, and extraction timeouts 504. These do not expose yt-dlp stderr.

The response includes video and channel metadata, format URLs, captions and empty related items where unavailable. Missing data is null or absent, not inferred. `publishedTime` is UTC ISO when a timestamp is available, otherwise the upload date in `YYYY-MM-DD`. Format/caption `expiration` is the earliest known URL `expire` query parameter, or null if none is available; it is not a guarantee that a URL will remain usable. Manual and automatic captions are distinguished. Signed media URLs can expire, and cache entries live at most one minute and no later than known expiry minus five seconds.

## Tests and CI

```sh
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Tests use a fake local yt-dlp executable; they do not prove YouTube connectivity. CI runs these checks on Node 22. `npm run lint:fix` modifies files; `npm run lint` does not.

## Deployment architecture

The Vercel function in `api/video.ts` validates input and forwards requests to a separately hosted worker over HTTPS. yt-dlp is not bundled in the function: a Vercel Node function has a bounded duration, an ephemeral writable `/tmp`, a read-only deployment filesystem, and deployment tracing/size constraints; a system Python/yt-dlp binary is not guaranteed. YouTube extraction may require frequent yt-dlp updates and a JS runtime, and successful extraction from a cloud IP is not guaranteed. The repository's `Dockerfile` packages Node, Python and a pinned yt-dlp for a long-running container host, but it must be built, maintained, and verified on that host. This is not a complete production deployment until a worker is provisioned and tested.

1. Deploy the Dockerfile to a container service with outbound HTTPS access to YouTube, TLS termination, and a public HTTPS address. Configure `WORKER_SECRET` to a long random value in the worker's secret manager. Restrict network access to the worker where possible. **Without this variable the worker is unauthenticated in local development; it refuses to start when `NODE_ENV=production` is set.** Worker secret checks use a constant-time comparison for equal-length values.
2. Create or select the appropriate Vercel project and deploy this repository. Configure `WORKER_URL` to the worker's HTTPS origin and `WORKER_SECRET` to the same secret in Vercel's encrypted environment variables. Redeploy after setting them. Do not commit secrets. The proxy returns 503 if either is missing, rejects redirects, and never sends the secret to clients.
3. Test GET and POST with an accessible video, invalid input, an unavailable video, and inspect worker and Vercel logs. Ensure Vercel Function duration supports the configured 30 seconds. Configure edge/WAF rate limiting and monitoring before exposing the API publicly.

`WORKER_URL` is a trusted operator-controlled HTTPS origin, not a user input; do not set it to untrusted hosts. Both the worker and the proxy have bounded **process-local** rate limits, and worker concurrency/cache/in-flight deduplication are per process, not shared across replicas or serverless instances. A reverse proxy can make all worker requests appear to come from one IP; configure deployment-level distributed per-client limiting rather than relying on these limits. Configure resource and network isolation for the worker. No cookies or credentials are supplied to yt-dlp. Restrict CORS if a narrower browser access policy is required.
