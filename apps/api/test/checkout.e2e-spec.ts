import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SIGNATURE_HEADER } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';
import { signPayload } from './../src/payments/signature.js';
import { Jar } from './support.js';

const ADDRESS = { fullName: 'Test Buyer', line1: '1 Garden Way', city: 'Portland', region: 'OR', postalCode: '97201', country: 'US' };
const card = (number: string, over: Record<string, unknown> = {}) => ({
  number,
  expMonth: 12,
  expYear: new Date().getFullYear() + 2,
  cvc: '123',
  name: 'Test Buyer',
  ...over,
});

describe('Cart + checkout + payments (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.listen(0);
    // The mock processor posts its webhook over real HTTP, so point it at this ephemeral server.
    process.env.PAYMENT_WEBHOOK_URL = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    db = app.get(DB);
  });

  afterAll(async () => {
    await app.close();
  });

  async function customer() {
    const jar = new Jar();
    const email = `buyer-${crypto.randomUUID().slice(0, 8)}@example.com`;
    jar.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Test Buyer', email, password: 'correct-horse-9' }));
    const inbox = await http().get('/api/demo-inbox').set('Cookie', jar.header());
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    jar.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));
    return { jar, email };
  }

  /** A variant with deterministic stock for the test. */
  async function variantWithStock(stock: number, slug = 'pothos-golden') {
    const { rows } = await db.execute<{ id: string; price_cents: number }>(sql`
      select v.id, v.price_cents from product_variant v join product p on p.id = v.product_id
      where p.slug = ${slug} order by v.price_cents limit 1`);
    const variant = rows[0]!;
    await db.execute(sql`update inventory_level set on_hand = ${stock} where variant_id = ${variant.id}`);
    return variant;
  }

  const stockOf = async (variantId: string) =>
    (await db.execute<{ on_hand: number }>(sql`select on_hand from inventory_level where variant_id = ${variantId}`)).rows[0]!.on_hand;

  const addToCart = (jar: Jar, variantId: string, quantity = 1) =>
    http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId, quantity }).then((r) => jar.absorb(r));

  const createOrder = (jar: Jar) =>
    http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS });

  const pay = (jar: Jar, orderId: string, number: string, over: Record<string, unknown> = {}) =>
    http().post(`/api/checkout/orders/${orderId}/pay`).set('Cookie', jar.header()).send({ card: card(number, over) });

  describe('cart', () => {
    it('adds, updates, caps by stock and removes', async () => {
      const v = await variantWithStock(2);
      const jar = new Jar();

      const added = await addToCart(jar, v.id, 2);
      expect(added.status).toBe(201);
      expect(added.body).toMatchObject({ itemCount: 2, subtotalCents: v.price_cents * 2 });
      expect(jar.header()).toContain('plantify_cart=');

      await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId: v.id, quantity: 1 }).expect(409);
      await http().patch(`/api/cart/items/${v.id}`).set('Cookie', jar.header()).send({ quantity: 1 }).expect(200);

      const view = await http().get('/api/cart').set('Cookie', jar.header()).expect(200);
      expect(view.body.lines).toHaveLength(1);
      expect(view.body.lines[0]).toMatchObject({ quantity: 1, stock: 2 });

      const removed = await http().delete(`/api/cart/items/${v.id}`).set('Cookie', jar.header()).expect(200);
      expect(removed.body.lines).toHaveLength(0);
    });

    it('refuses sold-out and unknown variants', async () => {
      const v = await variantWithStock(0);
      await http().post('/api/cart/items').send({ variantId: v.id, quantity: 1 }).expect(409);
      await http().post('/api/cart/items').send({ variantId: 'nope', quantity: 1 }).expect(404);
    });

    it('free shipping starts at $50', async () => {
      const cheap = await variantWithStock(50);
      const jar = new Jar();
      const view = await addToCart(jar, cheap.id, 1);
      expect(view.body.shippingCents).toBe(799);
      const many = await http().patch(`/api/cart/items/${cheap.id}`).set('Cookie', jar.header()).send({ quantity: 10 });
      if (many.body.subtotalCents >= 5000) expect(many.body.shippingCents).toBe(0);
    });
  });

  describe('checkout', () => {
    it('needs a non-empty cart, and an email from guests', async () => {
      await http().post('/api/checkout/orders').send({ shippingAddress: ADDRESS, email: 'guest@example.com' }).expect(400);
      const { jar } = await customer();
      await createOrder(jar).expect(400);
    });

    it('pays with the demo card: order paid, stock down, invoice issued, cart cleared, receipt emailed', async () => {
      const v = await variantWithStock(10);
      const { jar } = await customer();
      await addToCart(jar, v.id, 2);

      const created = await createOrder(jar).expect(201);
      const orderId = created.body.orderId as string;

      const paid = await pay(jar, orderId, '1234 5678 9').expect(201);
      expect(paid.body).toEqual({ status: 'paid', orderId });

      const order = await http().get(`/api/orders/${orderId}`).set('Cookie', jar.header()).expect(200);
      expect(order.body).toMatchObject({
        status: 'paid',
        itemCount: 2,
        payment: { status: 'succeeded', cardLast4: '6789' },
      });
      expect(order.body.invoice.number).toMatch(/^PLT-\d{4}-\d{4}$/);
      expect(order.body.totalCents).toBe(
        order.body.subtotalCents + order.body.shippingCents + order.body.taxCents,
      );

      expect(await stockOf(v.id)).toBe(8);
      const movement = await db.execute<{ delta: number }>(sql`select delta from inventory_movement where order_id = ${orderId}`);
      expect(movement.rows).toEqual([{ delta: -2 }]);

      const cart = await http().get('/api/cart').set('Cookie', jar.header()).expect(200);
      expect(cart.body.lines).toHaveLength(0);

      const inbox = await http().get('/api/demo-inbox').set('Cookie', jar.header()).expect(200);
      expect(inbox.body.messages.some((m: { subject: string }) => m.subject.includes(order.body.number))).toBe(true);
    });

    it('declined card leaves the order unpaid and retryable, stock untouched', async () => {
      const v = await variantWithStock(10);
      const { jar } = await customer();
      await addToCart(jar, v.id, 1);
      const { orderId } = (await createOrder(jar).expect(201)).body;

      const declined = await pay(jar, orderId, '000000000').expect(201);
      expect(declined.body).toEqual({ status: 'failed', orderId, reason: 'card_declined' });
      expect((await http().get(`/api/orders/${orderId}`).set('Cookie', jar.header())).body.status).toBe('pending_payment');
      expect(await stockOf(v.id)).toBe(10);

      const retry = await pay(jar, orderId, '123456789').expect(201);
      expect(retry.body.status).toBe('paid');
      expect(await stockOf(v.id)).toBe(9);
    });

    it('3-D Secure card needs a confirmation step', async () => {
      const v = await variantWithStock(10);
      const { jar } = await customer();
      await addToCart(jar, v.id, 1);
      const { orderId } = (await createOrder(jar).expect(201)).body;

      const first = await pay(jar, orderId, '111111111').expect(201);
      expect(first.body).toMatchObject({ status: 'requires_action', orderId });
      expect((await http().get(`/api/orders/${orderId}`).set('Cookie', jar.header())).body.status).toBe('pending_payment');

      const confirmed = await http().post(`/api/checkout/payments/${first.body.paymentId}/confirm`).set('Cookie', jar.header()).expect(201);
      expect(confirmed.body).toEqual({ status: 'paid', orderId });
      await http().post(`/api/checkout/payments/${first.body.paymentId}/confirm`).set('Cookie', jar.header()).expect(409);
    });

    it('rejects unknown card numbers, wrong CVC and expired cards', async () => {
      const v = await variantWithStock(10);
      const { jar } = await customer();
      await addToCart(jar, v.id, 1);
      const { orderId } = (await createOrder(jar).expect(201)).body;

      await pay(jar, orderId, '5555555555554444').expect(400);
      await pay(jar, orderId, '123456789', { cvc: '999' }).expect(400);
      await pay(jar, orderId, '123456789', { expYear: 2020 }).expect(400);
      expect((await http().get(`/api/orders/${orderId}`).set('Cookie', jar.header())).body.status).toBe('pending_payment');
    });

    it("keeps one customer's orders private", async () => {
      const v = await variantWithStock(10);
      const a = await customer();
      const b = await customer();
      await addToCart(a.jar, v.id, 1);
      const { orderId } = (await createOrder(a.jar).expect(201)).body;

      await http().get(`/api/orders/${orderId}`).set('Cookie', b.jar.header()).expect(404);
      await pay(b.jar, orderId, '123456789').expect(404);
      expect((await http().get('/api/orders').set('Cookie', b.jar.header()).expect(200)).body).toEqual([]);
    });
  });

  describe('payment webhook', () => {
    const post = (body: string, signature?: string) => {
      const req = http().post('/api/webhooks/payments').set('content-type', 'application/json');
      if (signature) req.set(SIGNATURE_HEADER, signature);
      return req.send(body);
    };

    async function pendingPayment() {
      const v = await variantWithStock(10);
      const { jar } = await customer();
      await addToCart(jar, v.id, 1);
      const { orderId } = (await createOrder(jar).expect(201)).body;
      const first = await pay(jar, orderId, '111111111').expect(201); // creates a requires_action payment
      return { v, jar, orderId, paymentId: first.body.paymentId as string };
    }

    const event = (id: string, orderId: string, paymentId: string) =>
      JSON.stringify({ id, type: 'payment.succeeded', createdAt: new Date().toISOString(), data: { paymentId, orderId } });

    it('rejects missing, wrong and stale signatures', async () => {
      const { orderId, paymentId } = await pendingPayment();
      const body = event(`evt_${crypto.randomUUID()}`, orderId, paymentId);
      const secret = process.env.PAYMENT_WEBHOOK_SECRET!;

      await post(body).expect(401);
      await post(body, signPayload(body, 'wrong-secret')).expect(401);
      await post(body, signPayload(body + ' ', secret)).expect(401); // signed a different body
      await post(body, signPayload(body, secret, Math.floor(Date.now() / 1000) - 3600)).expect(401); // replayed old capture
      expect((await db.execute(sql`select status from "order" where id = ${orderId}`)).rows[0]).toEqual({ status: 'pending_payment' });
    });

    it('is idempotent: a redelivered event does not double-count stock', async () => {
      const { v, orderId, paymentId } = await pendingPayment();
      const body = event(`evt_${crypto.randomUUID()}`, orderId, paymentId);
      const sig = () => signPayload(body, process.env.PAYMENT_WEBHOOK_SECRET!);

      expect((await post(body, sig()).expect(200)).body).toEqual({ received: true, result: 'paid' });
      expect((await post(body, sig()).expect(200)).body).toEqual({ received: true, result: 'duplicate' });
      expect(await stockOf(v.id)).toBe(9);

      // A different event id for an already-paid order is ignored too.
      const again = event(`evt_${crypto.randomUUID()}`, orderId, paymentId);
      expect((await post(again, signPayload(again, process.env.PAYMENT_WEBHOOK_SECRET!)).expect(200)).body.result).toBe('ignored');
      expect(await stockOf(v.id)).toBe(9);
    });

    it('rejects malformed events even with a valid signature', async () => {
      const body = JSON.stringify({ hello: 'world' });
      await post(body, signPayload(body, process.env.PAYMENT_WEBHOOK_SECRET!)).expect(400);
    });
  });

  it('never oversells: two buyers, one unit, exactly one order is paid', async () => {
    const v = await variantWithStock(1);
    const a = await customer();
    const b = await customer();
    await addToCart(a.jar, v.id, 1);
    await addToCart(b.jar, v.id, 1);
    // Both pass the pre-payment stock check because the unit is not reserved until payment.
    const [oa, ob] = await Promise.all([createOrder(a.jar).expect(201), createOrder(b.jar).expect(201)]);

    const results = await Promise.all([
      pay(a.jar, oa.body.orderId, '123456789'),
      pay(b.jar, ob.body.orderId, '123456789'),
    ]);
    const statuses = results.map((r) => r.body.status as string).sort((a, b) => a.localeCompare(b));
    expect(statuses).toEqual(['failed', 'paid']);
    expect(await stockOf(v.id)).toBe(0);

    const loser = results.find((r) => r.body.status === 'failed')!;
    expect(loser.body.reason).toBe('out_of_stock');
  });
});
