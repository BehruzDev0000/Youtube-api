/* yt-dlp is an external program; its JSON varies by extractor and video. */
type Track = { url?: string; name?: string; ext?: string };
type Format = {
  url?: string;
  vcodec?: string;
  acodec?: string;
  ext?: string;
  format_note?: string;
  format_id?: string;
  width?: number;
  height?: number;
  filesize?: number;
  filesize_approx?: number;
  protocol?: string;
};
type Info = {
  id?: string;
  title?: string;
  description?: string;
  channel_id?: string;
  channel?: string;
  channel_url?: string;
  channel_follower_count?: number;
  duration?: number;
  view_count?: number;
  like_count?: number;
  upload_date?: string;
  timestamp?: number;
  is_live?: boolean;
  was_live?: boolean;
  availability?: string;
  thumbnails?: { url?: string; width?: number; height?: number }[];
  formats?: Format[];
  subtitles?: Record<string, Track[]>;
  automatic_captions?: Record<string, Track[]>;
};

function expiry(url: string | undefined): number | null {
  try {
    const value = new URL(url || '').searchParams.get('expire');
    const n = Number(value);
    return value && Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
function earliest(urls: (string | undefined)[]): number | null {
  const values = urls.map(expiry).filter((n): n is number => n !== null);
  return values.length ? Math.min(...values) : null;
}
function mime(f: Format): string | null {
  const types: Record<string, string> = {
    mp4: 'video/mp4',
    webm: f.vcodec && f.vcodec !== 'none' ? 'video/webm' : 'audio/webm',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
  };
  return f.ext ? (types[f.ext] ?? null) : null;
}
export function mapYtDlpToApi(raw: unknown) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof (raw as Info).id !== 'string' ||
    (raw as Info).id!.length === 0
  )
    throw new Error('Invalid video metadata');
  const info = raw as Info;
  const formats = Array.isArray(info.formats) ? info.formats : [];
  const items = formats
    .filter((f) => typeof f.url === 'string')
    .map((f) => ({
      url: f.url,
      lengthMs:
        typeof info.duration === 'number'
          ? Math.round(info.duration * 1000)
          : null,
      mimeType: mime(f),
      extension: f.ext ?? null,
      size: f.filesize ?? f.filesize_approx ?? null,
      hasAudio: !!f.acodec && f.acodec !== 'none',
      quality: f.format_note ?? f.format_id ?? null,
      width: f.width ?? null,
      height: f.height ?? null,
      itag: f.format_id ?? null,
      protocol: f.protocol ?? null,
      hasVideo: !!f.vcodec && f.vcodec !== 'none',
    }));
  const videos = items.filter((i) => i.hasVideo);
  const audios = items.filter((i) => !i.hasVideo && i.hasAudio);
  const subtitles: {
    url: string;
    code: string;
    text: string;
    automatic: boolean;
    extension: string | null;
  }[] = [];
  for (const [automatic, tracks] of [
    [false, info.subtitles],
    [true, info.automatic_captions],
  ] as const) {
    for (const [code, entries] of Object.entries(tracks || {})) {
      if (!Array.isArray(entries)) continue;
      for (const track of entries)
        if (track.url)
          subtitles.push({
            url: track.url,
            code,
            text: track.name ?? code,
            automatic,
            extension: track.ext ?? null,
          });
    }
  }
  const date = info.upload_date;
  const publishedTime =
    typeof info.timestamp === 'number' && Number.isFinite(info.timestamp)
      ? new Date(info.timestamp * 1000).toISOString()
      : date && /^\d{8}$/.test(date)
        ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
        : null;
  return {
    errorId: 'Success',
    type: 'video',
    id: info.id!,
    title: info.title ?? null,
    description: info.description ?? null,
    channel: {
      type: 'channel',
      id: info.channel_id ?? null,
      name: info.channel ?? null,
      url: info.channel_url ?? null,
      subscriberCount: info.channel_follower_count ?? null,
    },
    lengthSeconds: info.duration ?? null,
    viewCount: info.view_count ?? null,
    likeCount: info.like_count ?? null,
    publishedTime,
    isLiveStream: Boolean(info.is_live || info.was_live),
    isLiveNow: Boolean(info.is_live),
    isUnlisted: info.availability ? info.availability === 'unlisted' : null,
    thumbnails: info.thumbnails ?? [],
    videos: {
      errorId: 'Success',
      expiration: earliest(videos.map((i) => i.url)),
      items: videos,
    },
    audios: {
      errorId: 'Success',
      expiration: earliest(audios.map((i) => i.url)),
      items: audios,
    },
    subtitles: {
      errorId: 'Success',
      expiration: earliest(subtitles.map((i) => i.url)),
      items: subtitles,
    },
    related: { nextToken: null, items: [] },
  };
}
