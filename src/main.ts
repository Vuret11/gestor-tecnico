import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads',
    setHeaders: (res) => { res.setHeader('Access-Control-Allow-Origin', '*'); },
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // CORS: CORS_ORIGIN admite varios orígenes separados por comas (el panel se abre
  // por IP, por nombre .local o por localhost según el dispositivo). Sin cabecera
  // Origin (curl, apps móviles, healthchecks) se permite.
  const origenes = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || origenes.includes(origin)),
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Gestor Técnico API')
    .setDescription('API REST para gestión de visitas, instalaciones y técnicos')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API corriendo en: http://localhost:${port}/api/v1`);
  console.log(`Swagger UI en:    http://localhost:${port}/api/docs`);
}
bootstrap();
