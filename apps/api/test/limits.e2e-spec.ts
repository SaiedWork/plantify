import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RATE_LIMITS } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';
import { RateLimiter } from './../src/common/rate-limit.js';

describe('Abuse protection (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    db = app.get(DB);
    process.env.APP_RATE_LIMIT = 'on';
    await db.execute(sql`delete from rate_limit where key like 'plantify:%'`);
  });

  afterAll(async () => {
    process.env.APP_RATE_LIMIT = 'off';
    await db.execute(sql`delete from rate_limit where key like 'plantify:%'`);
    await app.close();
  });

  it('returns 429 with Retry-After once the cart limit is exceeded', async () => {
    const { max } = RATE_LIMITS.cart;
    for (let i = 0; i < max; i++) {
      expect((await request(app.getHttpServer()).get('/api/cart')).status).toBe(200);
    }
    const res = await request(app.getHttpServer()).get('/api/cart');
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('does not limit routes without a bucket', async () => {
    for (let i = 0; i < 5; i++) expect((await request(app.getHttpServer()).get('/api/health')).status).toBe(200);
  });

  it('starts a fresh window once the previous one has expired', async () => {
    const limiter = app.get(RateLimiter);
    const t0 = Date.now();
    expect((await limiter.hit('unit:a', 1, 10, t0)).allowed).toBe(true);
    expect((await limiter.hit('unit:a', 1, 10, t0 + 1000)).allowed).toBe(false);
    expect((await limiter.hit('unit:a', 1, 10, t0 + 11_000)).allowed).toBe(true);
  });
});
