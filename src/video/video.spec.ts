import { canonicalizeUrl } from './url';
import { mapYtDlpToApi } from './video.mapper';
import { RateLimiter } from './video.service';

describe('YouTube URL validation', () => {
  it.each([
    'https://youtu.be/G33j5Qi4rE8?t=4',
    'https://www.youtube.com/watch?v=G33j5Qi4rE8&feature=share',
    'http://m.youtube.com/watch?v=G33j5Qi4rE8',
  ])('canonicalizes %s', (value) => {
    expect(canonicalizeUrl(value)).toBe(
      'https://www.youtube.com/watch?v=G33j5Qi4rE8',
    );
  });
  it.each([
    undefined,
    null,
    42,
    {},
    '',
    'https://youtu.be/',
    'https://youtu.be/G33j5Qi4rE8/other',
    'https://youtube.com.evil.test/watch?v=G33j5Qi4rE8',
    'https://youtube.com/watch?v=G33j5Qi4rE8&list=PL123',
    'https://youtube.com/watch?v=G33j5Qi4rE8&v=G33j5Qi4rE8',
    'https://user:pass@youtube.com/watch?v=G33j5Qi4rE8',
    'file:///etc/passwd',
  ])('rejects %p', (value) => expect(() => canonicalizeUrl(value)).toThrow());
});

describe('metadata mapping', () => {
  it('maps known fields and real expirations without inventing metadata', () => {
    const result = mapYtDlpToApi({
      id: 'G33j5Qi4rE8',
      duration: 2,
      like_count: 0,
      upload_date: '20210102',
      was_live: true,
      formats: [
        {
          url: 'https://x.test/v?expire=2000000000',
          ext: 'mp4',
          vcodec: 'avc',
          acodec: 'none',
          format_id: '137',
        },
        { url: 'https://x.test/a', ext: 'm4a', vcodec: 'none', acodec: 'aac' },
      ],
      subtitles: { en: [{ url: 'https://x.test/s', ext: 'vtt' }] },
    });
    expect(result.likeCount).toBe(0);
    expect(result.publishedTime).toBe('2021-01-02');
    expect(result.isLiveStream).toBe(true);
    expect(result.isLiveNow).toBe(false);
    expect(result.videos.expiration).toBe(2000000000);
    expect(result.audios.expiration).toBeNull();
    expect(result.videos.items[0].mimeType).toBe('video/mp4');
    expect(result.subtitles.items[0].automatic).toBe(false);
  });
  it('rejects invalid metadata', () =>
    expect(() => mapYtDlpToApi({})).toThrow());
});

describe('rate limit', () => {
  it('limits requests per client', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 30; i++) limiter.check('one');
    expect(() => limiter.check('one')).toThrow();
    expect(() => limiter.check('two')).not.toThrow();
  });
});
