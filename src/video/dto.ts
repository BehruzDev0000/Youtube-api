
export class GetInfoDto {
  url!: string;
}

export interface ApiLikeResponse {
  errorId: 'Success' | string;
  type: 'video';
  id: string;
  title?: string;
  description?: string;
  channel?: any;
  lengthSeconds?: number;
  viewCount?: number | null;
  likeCount?: number | null;
  publishedTime?: string | null;
  isLiveStream?: boolean;
  isLiveNow?: boolean;
  isRegionRestricted?: boolean | null;
  isUnlisted?: boolean | null;
  isCommentDisabled?: boolean | null;
  commentCountText?: string | null;
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
  musicCredits?: any[];
  videos?: { errorId: 'Success'; expiration: number; items: any[] };
  audios?: { errorId: 'Success'; expiration: number; items: any[] };
  subtitles?: { errorId: 'Success'; expiration: number; items: any[] };
  related?: { nextToken?: string | null; items: any[] };
}
