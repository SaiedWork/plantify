import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';
import { Jar } from './support.js';

const addr = (over: Record<string, unknown> = {}) => ({
  fullName: 'Ada Gardener',
  line1: '12 Fern Street',
  city: 'Seattle',
  region: 'WA',
  postalCode: '98101',
  country: 'US',
  ...over,
});

describe('Customer account (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.listen(0);
    process.env.PAYMENT_WEBHOOK_URL = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    db = app.get(DB);
  });

  afterAll(async () => {
    await app.close();
  });

  async function customer() {
    const jar = new Jar();
    const email = `acct-${crypto.randomUUID().slice(0, 8)}@example.com`;
    jar.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Ada Gardener', email, password: 'correct-horse-9' }));
    const inbox = await http().get('/api/demo-inbox').set('Cookie', jar.header());
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    jar.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));
    return { jar, email };
  }

  describe('saved addresses', () => {
    it('requires a session', () => http().get('/api/addresses').expect(401));

    it('makes the first address the default and moves the default on request', async () => {
      const { jar } = await customer();
      const first = await http().post('/api/addresses').set('Cookie', jar.header()).send(addr()).expect(201);
      expect(first.body).toMatchObject({ isDefault: true, line2: null, city: 'Seattle' });

      const second = await http().post('/api/addresses').set('Cookie', jar.header()).send(addr({ line1: '9 Moss Road' })).expect(201);
      expect(second.body.isDefault).toBe(false);

      await http().patch(`/api/addresses/${second.body.id}`).set('Cookie', jar.header()).send({ isDefault: true }).expect(200);
      const list = await http().get('/api/addresses').set('Cookie', jar.header()).expect(200);
      expect(list.body.map((a: { id: string; isDefault: boolean }) => [a.id, a.isDefault])).toEqual([
        [second.body.id, true],
        [first.body.id, false],
      ]);
    });

    it('edits fields and clears optional ones', async () => {
      const { jar } = await customer();
      const created = await http().post('/api/addresses').set('Cookie', jar.header()).send(addr({ line2: 'Apt 4' })).expect(201);
      expect(created.body.line2).toBe('Apt 4');
      const updated = await http().patch(`/api/addresses/${created.body.id}`).set('Cookie', jar.header()).send({ city: 'Tacoma', line2: '' }).expect(200);
      expect(updated.body).toMatchObject({ city: 'Tacoma', line2: null, line1: '12 Fern Street' });
    });

    it('promotes another address when the default is deleted', async () => {
      const { jar } = await customer();
      const a = await http().post('/api/addresses').set('Cookie', jar.header()).send(addr()).expect(201);
      const b = await http().post('/api/addresses').set('Cookie', jar.header()).send(addr({ line1: '2 Other St' })).expect(201);
      await http().delete(`/api/addresses/${a.body.id}`).set('Cookie', jar.header()).expect(204);
      const list = await http().get('/api/addresses').set('Cookie', jar.header()).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ id: b.body.id, isDefault: true });
    });

    it("never exposes or changes another customer's addresses", async () => {
      const a = await customer();
      const b = await customer();
      const mine = await http().post('/api/addresses').set('Cookie', a.jar.header()).send(addr()).expect(201);

      expect((await http().get('/api/addresses').set('Cookie', b.jar.header()).expect(200)).body).toEqual([]);
      await http().patch(`/api/addresses/${mine.body.id}`).set('Cookie', b.jar.header()).send({ city: 'Hacked' }).expect(404);
      await http().delete(`/api/addresses/${mine.body.id}`).set('Cookie', b.jar.header()).expect(404);
      expect((await http().get('/api/addresses').set('Cookie', a.jar.header())).body[0].city).toBe('Seattle');
    });

    it('validates input and caps the address book', async () => {
      const { jar } = await customer();
      await http().post('/api/addresses').set('Cookie', jar.header()).send(addr({ postalCode: '' })).expect(400);
      await http().post('/api/addresses').set('Cookie', jar.header()).send(addr({ country: 'USA' })).expect(400);

      for (let i = 0; i < 10; i++) {
        await http().post('/api/addresses').set('Cookie', jar.header()).send(addr({ line1: `${i} Loop Lane` })).expect(201);
      }
      await http().post('/api/addresses').set('Cookie', jar.header()).send(addr()).expect(409);
    });
  });

  describe('profile and password (Better Auth)', () => {
    it('updates the display name', async () => {
      const { jar } = await customer();
      await http().post('/api/auth/update-user').set('Cookie', jar.header()).send({ name: 'Ada L.' }).expect(200);
      const me = await http().get('/api/me').set('Cookie', jar.header()).expect(200);
      expect(me.body.name).toBe('Ada L.');
    });

    it('changes the password: old one stops working, new one works, role cannot be edited', async () => {
      const { jar, email } = await customer();
      await http()
        .post('/api/auth/change-password')
        .set('Cookie', jar.header())
        .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-pass-1' })
        .expect(400);
      await http()
        .post('/api/auth/change-password')
        .set('Cookie', jar.header())
        .send({ currentPassword: 'correct-horse-9', newPassword: 'brand-new-pass-1' })
        .expect(200);

      await http().post('/api/auth/sign-in/email').send({ email, password: 'correct-horse-9' }).expect(401);
      await http().post('/api/auth/sign-in/email').send({ email, password: 'brand-new-pass-1' }).expect(200);

      // update-user must not be a route to privilege escalation.
      await http().post('/api/auth/update-user').set('Cookie', jar.header()).send({ role: 'owner' });
      const me = await http().get('/api/me').set('Cookie', jar.header()).expect(200);
      expect(me.body.role).toBe('customer');
    });
  });

  describe('order history', () => {
    async function pendingOrder(jar: Jar) {
      const { rows } = await db.execute<{ id: string }>(sql`
        select v.id from product_variant v join product p on p.id = v.product_id
        where p.slug = 'spider-plant-variegata' order by v.price_cents limit 1`);
      const variantId = rows[0]!.id;
      await db.execute(sql`update inventory_level set on_hand = 20 where variant_id = ${variantId}`);
      jar.absorb(await http().post('/api/cart/items').send({ variantId, quantity: 1 }).set('Cookie', jar.header()));
      const created = await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: addr() }).expect(201);
      return created.body.orderId as string;
    }

    it('lists only my orders, newest first, and cancels an unpaid one', async () => {
      const { jar } = await customer();
      const first = await pendingOrder(jar);
      const second = await pendingOrder(jar);

      const list = await http().get('/api/orders').set('Cookie', jar.header()).expect(200);
      expect(list.body.map((o: { id: string }) => o.id)).toEqual([second, first]);

      const cancelled = await http().post(`/api/orders/${first}/cancel`).set('Cookie', jar.header()).expect(201);
      expect(cancelled.body).toEqual({ status: 'cancelled' });
      expect((await http().get(`/api/orders/${first}`).set('Cookie', jar.header())).body.status).toBe('cancelled');
      await http().post(`/api/orders/${first}/cancel`).set('Cookie', jar.header()).expect(409);
    });

    it('cannot cancel a paid order or someone elses order', async () => {
      const a = await customer();
      const b = await customer();
      const orderId = await pendingOrder(a.jar);

      await http().post(`/api/orders/${orderId}/cancel`).set('Cookie', b.jar.header()).expect(404);

      const card = { number: '123456789', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Ada' };
      await http().post(`/api/checkout/orders/${orderId}/pay`).set('Cookie', a.jar.header()).send({ card }).expect(201);
      await http().post(`/api/orders/${orderId}/cancel`).set('Cookie', a.jar.header()).expect(409);
      expect((await http().get(`/api/orders/${orderId}`).set('Cookie', a.jar.header())).body.status).toBe('paid');
    });

    it('a cancelled order cannot be paid afterwards', async () => {
      const { jar } = await customer();
      const orderId = await pendingOrder(jar);
      await http().post(`/api/orders/${orderId}/cancel`).set('Cookie', jar.header()).expect(201);
      const card = { number: '123456789', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Ada' };
      await http().post(`/api/checkout/orders/${orderId}/pay`).set('Cookie', jar.header()).send({ card }).expect(409);
    });
  });
});
