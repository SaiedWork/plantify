import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DEMO_STAFF_PASSWORD } from '@plantify/db';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

const cookiesOf = (res: request.Response) =>
  ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).map((c) => c.split(';')[0]!);

describe('API (e2e)', () => {
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health is public', () =>
    http().get('/api/health').expect(200).expect({ status: 'ok', service: 'plantify-api' }));

  it('GET /api/me needs a session', () => http().get('/api/me').expect(401));

  it('customer signs up, reads the OTP from the demo inbox, verifies and gets a session', async () => {
    const email = `e2e-${Date.now()}@example.com`;

    const signUp = await http()
      .post('/api/auth/sign-up/email')
      .send({ name: 'E2E Customer', email, password: 'correct-horse-9' })
      .expect(200);
    const inboxCookie = cookiesOf(signUp).filter((c) => c.startsWith('demo_inbox='));
    expect(inboxCookie).toHaveLength(1);

    // Unverified accounts cannot sign in yet.
    await http().post('/api/auth/sign-in/email').send({ email, password: 'correct-horse-9' }).expect(403);

    const inbox = await http().get('/api/demo-inbox').set('Cookie', inboxCookie).expect(200);
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp)?.otp as string;
    expect(otp).toMatch(/^\d{6}$/);

    // Wrong code is rejected, the right one verifies and signs in.
    await http().post('/api/auth/email-otp/verify-email').send({ email, otp: '000000' }).expect(400);
    const verified = await http().post('/api/auth/email-otp/verify-email').send({ email, otp }).expect(200);

    const me = await http().get('/api/me').set('Cookie', cookiesOf(verified)).expect(200);
    expect(me.body).toMatchObject({ email, role: 'customer', permissions: [] });
  });

  it('a browser cannot read an inbox it did not trigger', async () => {
    const res = await http().get('/api/demo-inbox').expect(200);
    expect(res.body).toEqual({ emails: [], messages: [] });
  });

  it('clients cannot assign themselves a role at sign-up', async () => {
    const email = `e2e-role-${Date.now()}@example.com`;
    const signUp = await http()
      .post('/api/auth/sign-up/email')
      .send({ name: 'Sneaky', email, password: 'correct-horse-9', role: 'owner' });
    const inbox = await http().get('/api/demo-inbox').set('Cookie', cookiesOf(signUp));
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp)?.otp as string;
    const verified = await http().post('/api/auth/email-otp/verify-email').send({ email, otp }).expect(200);
    const me = await http().get('/api/me').set('Cookie', cookiesOf(verified)).expect(200);
    expect(me.body.role).toBe('customer');
  });

  it('seeded owner signs in with the demo password and gets owner permissions', async () => {
    const login = await http()
      .post('/api/auth/sign-in/email')
      .send({ email: 'owner@plantify.test', password: DEMO_STAFF_PASSWORD })
      .expect(200);
    const me = await http().get('/api/me').set('Cookie', cookiesOf(login)).expect(200);
    expect(me.body.role).toBe('owner');
    expect(me.body.permissions).toContain('billing:manage');
  });

  it('catalog manager lacks owner-only permissions', async () => {
    const login = await http()
      .post('/api/auth/sign-in/email')
      .send({ email: 'catalog@plantify.test', password: DEMO_STAFF_PASSWORD })
      .expect(200);
    const me = await http().get('/api/me').set('Cookie', cookiesOf(login)).expect(200);
    expect(me.body.role).toBe('catalog_manager');
    expect(me.body.permissions).not.toContain('billing:manage');
  });
});
