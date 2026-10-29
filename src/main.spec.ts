import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { KepcoController } from './kepco/kepco.controller';
import { KepcoService } from './kepco/kepco.service';
import { bootstrap } from './main';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';

describe('HTTP configuration', () => {
  let app: INestApplication<Server>;
  let settings: Record<string, string | number | undefined>;
  const paths = ['/api/kepco/usage', '/metrics'];

  beforeEach(async () => {
    settings = { PORT: 0 };
    const module = await Test.createTestingModule({
      controllers: [KepcoController, MetricsController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: (key: string) => settings[key] },
        },
        {
          provide: KepcoService,
          useValue: {
            getSmartUsageFee: jest.fn().mockResolvedValue({ usage: {} }),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            getMetrics: jest
              .fn()
              .mockResolvedValue('kepco_usage_realtime_kwh 50\n'),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    jest.spyOn(NestFactory, 'create').mockResolvedValue(app);
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it.each([undefined, '', '   '])(
    'binds to all IPv4 interfaces when HOST is %p and keeps endpoints available',
    async (host) => {
      settings.HOST = host;
      await bootstrap();
      const server = app.getHttpServer();
      expect(server.address()).toEqual(
        expect.objectContaining({ address: '0.0.0.0' }),
      );
      await request(server).get('/api/kepco/usage').expect(200, { usage: {} });
      await request(server)
        .get('/metrics')
        .expect(200, 'kepco_usage_realtime_kwh 50\n');
      await request(server).get('/api/metrics').expect(404);
    },
  );

  it('allows an explicit loopback interface', async () => {
    settings.HOST = '127.0.0.1';
    await bootstrap();
    expect(app.getHttpServer().address()).toEqual(
      expect.objectContaining({ address: '127.0.0.1' }),
    );
  });

  it.each([undefined, '', '*', ' * ', ' , * , '])(
    'does not grant cross-origin access when CORS is %p',
    async (origin) => {
      settings.CORS = origin;
      await bootstrap();
      for (const path of paths) {
        const response = await request(app.getHttpServer())
          .get(path)
          .set('Origin', 'https://untrusted.example')
          .expect(200);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
        expect(
          response.headers['access-control-allow-credentials'],
        ).toBeUndefined();
        const preflight = await request(app.getHttpServer())
          .options(path)
          .set('Origin', 'https://untrusted.example')
          .set('Access-Control-Request-Method', 'GET');
        expect(
          preflight.headers['access-control-allow-origin'],
        ).toBeUndefined();
      }
    },
  );

  it('grants CORS only to exact listed origins on usage and metrics', async () => {
    const allowedOrigins = [
      'https://dashboard.example',
      'https://admin.example',
    ];
    settings.CORS = ` , ${allowedOrigins[0]}, *, ${allowedOrigins[1]}, `;
    await bootstrap();
    for (const path of paths) {
      for (const origin of allowedOrigins) {
        const response = await request(app.getHttpServer())
          .get(path)
          .set('Origin', origin)
          .expect(200);
        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(
          response.headers['access-control-allow-credentials'],
        ).toBeUndefined();
        await request(app.getHttpServer())
          .options(path)
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'GET')
          .expect(204)
          .expect('Access-Control-Allow-Origin', origin);
      }
      for (const origin of [
        'https://untrusted.example',
        'https://dashboard.example.attacker.example',
        'http://dashboard.example',
        'null',
      ]) {
        const response = await request(app.getHttpServer())
          .get(path)
          .set('Origin', origin)
          .expect(200);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    }
  });
});
