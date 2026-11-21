import { BadRequestException } from '@nestjs/common';

/** Accept only individual YouTube watch/short links; drop tracking parameters. */
export function canonicalizeUrl(input: unknown): string {
  const invalid = () =>
    new BadRequestException('A valid YouTube video URL is required');
  if (
    typeof input !== 'string' ||
    input.length > 2048 ||
    input.trim() !== input
  )
    throw invalid();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw invalid();
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    throw invalid();
  let id: string | null = null;
  if (
    ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(
      url.hostname,
    ) &&
    url.pathname === '/watch'
  ) {
    const ids = url.searchParams.getAll('v');
    if (ids.length === 1) id = ids[0];
  } else if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1);
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw invalid();
  // Explicitly reject playlists instead of accidentally expanding them.
  if (url.searchParams.has('list')) throw invalid();
  return `https://www.youtube.com/watch?v=${id}`;
}
