import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService, RateLimiter } from './video.service';
@Module({
  controllers: [VideoController],
  providers: [VideoService, RateLimiter],
})
export class VideoModule {}
