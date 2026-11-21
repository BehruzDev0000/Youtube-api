import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.WORKER_SECRET)
    throw new Error('WORKER_SECRET is required in production');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );
  app.enableCors();
  await app.listen(Number(process.env.PORT || 3003), '0.0.0.0');
}
void bootstrap();
