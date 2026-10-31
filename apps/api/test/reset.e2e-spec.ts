import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RESET_INTERVAL_DAYS } from '@plantify/contracts';
import { getLastResetAt } from '@plantify/db';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';

describe('Demo reset (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;
  const auth = () => ({ Authorization: `Bearer ${process.env.CRON_SECRET}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    db = app.get(DB);
  });

  afterAll(() => app.close());

  it('rejects requests without the cron secret', async () => {
    expect((await http().post('/api/internal/reset')).status).toBe(401);
    expect((await http().post('/api/internal/reset').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect((await http().get('/api/internal/reset')).status).toBe(401);
  });

  it('exposes the countdown publicly', async () => {
    const res = await http().get('/api/demo/status');
    expect(res.status).toBe(200);
    expect(res.body.daysUntilReset).toBeGreaterThanOrEqual(0);
    expect(res.body.daysUntilReset).toBeLessThanOrEqual(RESET_INTERVAL_DAYS);
  });

  it('skips the reset while the data is younger than 7 days', async () => {
    const before = await getLastResetAt(db);
    const res = await http().get('/api/internal/reset').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reset: false, reason: 'not_due' });
    expect(await getLastResetAt(db)).toEqual(before);
  });

  it('resets when the data is old, and again only when forced', async () => {
    const old = new Date(Date.now() - (RESET_INTERVAL_DAYS + 1) * 24 * 60 * 60 * 1000);
    await db.execute(sql`update meta set value = ${old.toISOString()} where key = 'last_reset_at'`);
    await db.execute(sql`insert into rate_limit (id, key, count, last_request) values ('reset-test', 'plantify:reset-test', 1, 1)`);

    const due = await http().get('/api/internal/reset').set(auth());
    expect(due.body).toMatchObject({ reset: true });
    expect(due.body.seeded.products).toBeGreaterThan(0);
    expect(due.body.status.daysUntilReset).toBe(RESET_INTERVAL_DAYS);
    const { rows } = await db.execute(sql`select 1 from rate_limit where id = 'reset-test'`);
    expect(rows).toHaveLength(0);

    const again = await http().post('/api/internal/reset').set(auth());
    expect(again.body).toMatchObject({ reset: false });

    const forced = await http().post('/api/internal/reset?force=1').set(auth());
    expect(forced.body).toMatchObject({ reset: true });
  }, 120_000);

  it('keeps the seeded data and staff sessions, and removes only what was added', async () => {
    const login = await http().post('/api/auth/sign-in/email').send({ email: 'owner@plantify.test', password: 'plantify-demo' });
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
    const list = async () => (await http().get('/api/admin/products?pageSize=100').set('Cookie', cookie)).body.items as { id: string }[];

    const seededIds = (await list()).map((p) => p.id);
    expect(seededIds.length).toBeGreaterThan(0);
    await db.execute(sql`insert into "user" (id, name, email, role) values ('added-user', 'Added', 'added@example.com', 'customer')`);
    await db.execute(sql`insert into session (id, user_id, token, expires_at) values ('added-session', 'added-user', 'added-token', now() + interval '1 day')`);

    expect((await http().post('/api/internal/reset?force=1').set(auth())).body).toMatchObject({ reset: true });

    const after = await http().get('/api/admin/products?pageSize=100').set('Cookie', cookie);
    expect(after.status).toBe(200);
    expect((after.body.items as { id: string }[]).map((p) => p.id)).toEqual(seededIds);
    const { rows } = await db.execute(sql`select 1 from "user" where id = 'added-user' union all select 1 from session where id = 'added-session'`);
    expect(rows).toHaveLength(0);
  }, 120_000);
});
