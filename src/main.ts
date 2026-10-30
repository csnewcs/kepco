import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api', {
    exclude: ['metrics'],
  });
  const corsOrigins = configService
    .get<string>('CORS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '' && origin !== '*');
  if (corsOrigins.length > 0)
    app.enableCors({
      origin: corsOrigins,
    });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(
    configService.get('PORT', 3000),
    configService.get<string>('HOST', '0.0.0.0'),
  );
}
void bootstrap();
