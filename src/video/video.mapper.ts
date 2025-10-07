// src/video/video.mapper.ts
export function mapYtDlpToApi(info: any): any {
  const expiration = Math.floor(Date.now() / 1000) + 3600;

  const thumbnails =
    (info?.thumbnails || []).map((t: any) => ({
      url: t.url,
      width: t.width,
      height: t.height,
    })) || [];

  const channel = {
    type: 'channel',
    id: info?.channel_id,
    name: info?.channel,
    handle: null,
    isVerified: null,
    isVerifiedArtist: false,
    subscriberCountText: null,
    avatar: [],
  };

  const durationSec = info?.duration ?? 0;

  const videoItems: any[] = [];
  const audioItems: any[] = [];

  for (const f of info?.formats || []) {
    const hasVideo = f.vcodec && f.vcodec !== 'none';
    const hasAudio = f.acodec && f.acodec !== 'none';

    const item = {
      url: f.url,
      lengthMs: durationSec ? Math.round(durationSec * 1000) : null,
      mimeType: f.mime || f.mime_type,
      extension: f.ext,
      lastModified: null,
      size: f.filesize || f.filesize_approx || null,
      sizeText: f.filesize ? formatBytes(f.filesize) : (f.filesize_approx ? formatBytes(f.filesize_approx) : null),
      hasAudio,
      quality: f.format_note || f.format_id,
      width: f.width,
      height: f.height,
      itag: f.format_id,
    };

    if (hasVideo) videoItems.push(item);
    else if (hasAudio) audioItems.push(item);
  }

  const subtitlesItems: any[] = [];
  const autoCaps = info?.automatic_captions || {};
  for (const lang of Object.keys(autoCaps)) {
    const tracks = autoCaps[lang];
    if (tracks?.length) {
      subtitlesItems.push({
        url: tracks[0].url,
        code: lang,
        text: `${lang} (auto-generated)`,
      });
    }
  }

  const relatedItems =
    (info?.related_videos || []).map((e: any) => ({
      type: 'video',
      id: e.id,
      title: e.title,
      channel: {
        type: 'channel',
        id: e.channel_id,
        name: e.uploader,
        handle: null,
        isVerified: null,
        isVerifiedArtist: false,
        avatar: [],
      },
      isLiveNow: false,
      lengthText: e.duration ? secToHms(e.duration) : null,
      viewCountText: e.view_count ? `${e.view_count} views` : null,
      publishedTimeText: null,
      thumbnails: e.thumbnails || [],
    })) || [];

  return {
    errorId: 'Success',
    type: 'video',
    id: info?.id,
    title: info?.title,
    description: info?.description,
    channel,
    lengthSeconds: durationSec ? Math.round(durationSec) : 0,
    viewCount: info?.view_count ?? null,
    likeCount: null, 
    publishedTime: info?.upload_date ?? null, 
    isLiveStream: !!info?.is_live,
    isLiveNow: !!info?.is_live,
    isRegionRestricted: null,
    isUnlisted: null,
    isCommentDisabled: null,
    commentCountText: null,
    thumbnails,
    musicCredits: [],
    videos: { errorId: 'Success', expiration, items: videoItems },
    audios: { errorId: 'Success', expiration, items: audioItems },
    subtitles: { errorId: 'Success', expiration, items: subtitlesItems },
    related: { nextToken: null, items: relatedItems },
  };
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`;
}

function secToHms(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h) return `${h}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}
