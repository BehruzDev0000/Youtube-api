
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { VideoService } from './video.service';
import { GetInfoDto, ApiLikeResponse } from './dto';

@Controller('api')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('video')
  async getByQuery(@Query('url') url: string): Promise<ApiLikeResponse> {
    return this.videoService.getInfo(url);
  }

  @Post('video')
  async getByBody(@Body() body: GetInfoDto): Promise<ApiLikeResponse> {
    return this.videoService.getInfo(body.url);
  }
}
