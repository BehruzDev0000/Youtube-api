import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { RateLimiter, VideoService } from './video.service';

@Controller('api')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly limiter: RateLimiter,
  ) {}
  private authorize(req: FastifyRequest) {
    this.limiter.check(req.ip);
    const secret = process.env.WORKER_SECRET;
    if (secret) {
      const supplied = req.headers['x-worker-secret'];
      const a = Buffer.from(typeof supplied === 'string' ? supplied : '');
      const b = Buffer.from(secret);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        throw new UnauthorizedException();
    }
  }
  @Get('video')
  getByQuery(@Query('url') url: unknown, @Req() req: FastifyRequest) {
    this.authorize(req);
    return this.videoService.getInfo(url);
  }
  @Post('video')
  getByBody(@Body() body: unknown, @Req() req: FastifyRequest) {
    this.authorize(req);
    const url =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { url?: unknown }).url
        : undefined;
    return this.videoService.getInfo(url);
  }
}
