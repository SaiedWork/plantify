import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'drizzle-orm';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';
import { createHmac } from 'node:crypto';
import { signOrderLink } from './../src/orders/guest-access.js';
import { Jar } from './support.js';

const ADDRESS = { fullName: 'Guest Buyer', line1: '1 Garden Way', city: 'Portland', region: 'OR', postalCode: '97201', country: 'US' };
const card = (number: string) => ({ number, expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Guest Buyer' });

describe('Guest checkout (e2e)', () => {
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

  async function variantWithStock(stock: number) {
    const { rows } = await db.execute<{ id: string }>(sql`
      select v.id from product_variant v join product p on p.id = v.product_id where p.slug = 'pothos-golden' order by v.price_cents limit 1`);
    await db.execute(sql`update inventory_level set on_hand = ${stock} where variant_id = ${rows[0]!.id}`);
    return rows[0]!.id;
  }

  const newEmail = () => `guest-${crypto.randomUUID().slice(0, 8)}@example.com`;

  /** A guest browser that has a cart with one plant in it. */
  async function guestWithCart(quantity = 1) {
    const jar = new Jar();
    const variantId = await variantWithStock(20);
    jar.absorb(await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId, quantity }));
    return jar;
  }

  async function placeOrder(jar: Jar, email: string, cardNumber = '1234 5678 9') {
    const created = jar.absorb(await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS, email }));
    expect(created.status).toBe(201);
    const orderId = created.body.orderId as string;
    const paid = jar.absorb(await http().post(`/api/checkout/orders/${orderId}/pay`).set('Cookie', jar.header()).send({ card: card(cardNumber) }));
    return { orderId, paid };
  }

  const inbox = async (jar: Jar) =>
    (await http().get('/api/demo-inbox').set('Cookie', jar.header()).expect(200)).body.messages as { subject: string; html: string }[];

  it('lets a guest check out with an email, no account', async () => {
    const jar = await guestWithCart(2);
    const email = newEmail();
    const { orderId, paid } = await placeOrder(jar, email);
    expect(paid.status).toBe(201);
    expect(paid.body).toEqual({ status: 'paid', orderId });

    const order = await http().get(`/api/orders/${orderId}`).set('Cookie', jar.header()).expect(200);
    expect(order.body).toMatchObject({ status: 'paid', guest: true, contactEmail: email, itemCount: 2 });
    expect(order.body.events.map((e: { status: string }) => e.status)).toEqual(['pending_payment', 'paid']);

    // The paid order empties the guest cart, and the guest has no order list because there is no account.
    const cart = await http().get('/api/cart').set('Cookie', jar.header()).expect(200);
    expect(cart.body.itemCount).toBe(0);
    await http().get('/api/orders').set('Cookie', jar.header()).expect(401);
  });

  it('requires a valid email from guests', async () => {
    const jar = await guestWithCart();
    await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS }).expect(400);
    await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS, email: 'not-an-email' }).expect(400);
  });

  it('keeps a guest order private to the browser that created it', async () => {
    const jar = await guestWithCart();
    const created = jar.absorb(await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS, email: newEmail() }));
    const orderId = created.body.orderId as string;

    const other = new Jar();
    await http().post(`/api/checkout/orders/${orderId}/pay`).set('Cookie', other.header()).send({ card: card('1234 5678 9') }).expect(404);
    await http().get(`/api/orders/${orderId}`).set('Cookie', other.header()).expect(404);
    await http().get(`/api/orders/${orderId}`).expect(404);
  });

  it('emails a receipt to the demo inbox with a working 24h link', async () => {
    const jar = await guestWithCart();
    const { orderId } = await placeOrder(jar, newEmail());

    const receipt = (await inbox(jar)).find((m) => m.subject.includes('is confirmed'));
    const token = receipt!.html.match(/\/orders\/track\/([^"]+)"/)?.[1];
    expect(token).toBeDefined();

    const tracked = await http().get(`/api/orders/track/${token}`).expect(200);
    expect(tracked.body).toMatchObject({ id: orderId, status: 'paid', guest: true });

    await http().get(`/api/orders/track/${token!.slice(0, -2)}xx`).expect(404);
    const expired = signOrderLink(orderId, Date.now() - 25 * 60 * 60 * 1000).token;
    const gone = await http().get(`/api/orders/track/${expired}`).expect(410);
    expect(gone.body.code).toBe('link_expired');
  });

  it('sends a new link only when the order number and email match, and always answers the same', async () => {
    const jar = await guestWithCart();
    const email = newEmail();
    const { orderId } = await placeOrder(jar, email);
    const { rows } = await db.execute<{ number: string }>(sql`select number from "order" where id = ${orderId}`);
    const number = rows[0]!.number;

    const stranger = new Jar();
    const miss = await http().post('/api/orders/track/request-link').set('Cookie', stranger.header()).send({ orderNumber: number, email: newEmail() });
    expect(miss.body).toEqual({ ok: true });
    expect(await inbox(stranger)).toHaveLength(0);

    const hit = jar.absorb(await http().post('/api/orders/track/request-link').set('Cookie', jar.header()).send({ orderNumber: number, email: email.toUpperCase() }));
    expect(hit.body).toEqual({ ok: true });
    expect((await inbox(jar)).filter((m) => m.subject.includes(`Your link to order ${number}`))).toHaveLength(1);
  });

  it('attaches guest orders to the account once that email is verified', async () => {
    const jar = await guestWithCart();
    const email = newEmail();
    const { orderId } = await placeOrder(jar, email);
    const before = await db.execute<{ user_id: string | null }>(sql`select user_id from "order" where id = ${orderId}`);
    expect(before.rows[0]!.user_id).toBeNull();

    const account = new Jar();
    account.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Guest Buyer', email, password: 'correct-horse-9' }));
    const otp = (await http().get('/api/demo-inbox').set('Cookie', account.header())).body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    account.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));

    const orders = await http().get('/api/orders').set('Cookie', account.header()).expect(200);
    expect(orders.body.map((o: { id: string }) => o.id)).toContain(orderId);
    const after = await db.execute<{ user_id: string | null }>(sql`select user_id from "order" where id = ${orderId}`);
    expect(after.rows[0]!.user_id).not.toBeNull();
  });

  it('records a status event for every change, including admin ones', async () => {
    const jar = await guestWithCart();
    const { orderId } = await placeOrder(jar, newEmail());
    await db.execute(sql`update "order" set status = 'shipped' where id = ${orderId}`);
    const order = await http().get(`/api/orders/${orderId}`).set('Cookie', jar.header()).expect(200);
    expect(order.body.events.map((e: { status: string }) => e.status)).toEqual(['pending_payment', 'paid', 'shipped']);
  });

  const hasLifetime = (res: { headers: Record<string, unknown> }, name: string) => {
    const line = ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith(`${name}=`));
    expect(line).toBeDefined();
    return /max-age|expires/i.test(line!);
  };

  it('gives a guest session cookies that end when the browser closes', async () => {
    const jar = new Jar();
    const variantId = await variantWithStock(20);
    const cart = await http().post('/api/cart/items').send({ variantId, quantity: 1 });
    expect(hasLifetime(cart, 'plantify_cart')).toBe(false);
    jar.absorb(cart);

    const created = jar.absorb(await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS, email: newEmail() }));
    expect(hasLifetime(created, 'guest_orders')).toBe(false);
    const paid = await http().post(`/api/checkout/orders/${created.body.orderId}/pay`).set('Cookie', jar.header()).send({ card: card('1234 5678 9') });
    expect(hasLifetime(paid, 'demo_inbox')).toBe(false);
  });

  it('keeps a signed-in customer cart cookie for 30 days', async () => {
    const email = newEmail();
    const account = new Jar();
    account.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Guest Buyer', email, password: 'correct-horse-9' }));
    const otp = (await http().get('/api/demo-inbox').set('Cookie', account.header())).body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    account.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));

    const variantId = await variantWithStock(20);
    const cart = await http().post('/api/cart/items').set('Cookie', account.header()).send({ variantId, quantity: 1 });
    expect(hasLifetime(cart, 'plantify_cart')).toBe(true);
  });

  it('does not show a new guest session the mail an earlier session left for the same address', async () => {
    const first = await guestWithCart();
    const email = newEmail();
    const { orderId } = await placeOrder(first, email);
    expect((await inbox(first)).length).toBeGreaterThan(0);
    const { rows } = await db.execute<{ number: string }>(sql`select number from "order" where id = ${orderId}`);
    // The first session ended long ago.
    await db.execute(sql`update demo_email set created_at = now() - interval '1 hour' where "to" = ${email}`);

    const second = new Jar();
    second.absorb(await http().post('/api/orders/track/request-link').set('Cookie', second.header()).send({ orderNumber: rows[0]!.number, email }));
    const seen = await inbox(second);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.subject).toContain(`Your link to order ${rows[0]!.number}`);
  });

  it('shows a signed-in customer everything sent to their address, with no cookie needed', async () => {
    const email = newEmail();
    const account = new Jar();
    account.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Guest Buyer', email, password: 'correct-horse-9' }));
    const otp = (await http().get('/api/demo-inbox').set('Cookie', account.header())).body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    await http().post('/api/auth/email-otp/verify-email').send({ email, otp }).expect(200);
    await db.execute(sql`update demo_email set created_at = now() - interval '1 hour' where "to" = ${email}`);

    const session = new Jar();
    session.absorb(await http().post('/api/auth/sign-in/email').send({ email, password: 'correct-horse-9' }));
    const bare = session.header().split('; ').filter((c) => c.startsWith('better-auth')).join('; ');
    const res = await http().get('/api/demo-inbox').set('Cookie', bare);
    expect(res.body.messages.some((m: { otp?: string }) => m.otp)).toBe(true);
  });

  it('ignores an old-format inbox cookie that has no start time', async () => {
    const first = await guestWithCart();
    const email = newEmail();
    await placeOrder(first, email);
    // The format before sessions were scoped: just the address, which used to mean "everything".
    const secret = process.env.BETTER_AUTH_SECRET!;
    const value = encodeURIComponent(email);
    const legacy = `${value}.${createHmac('sha256', secret).update(value).digest('hex')}`;
    const res = await http().get('/api/demo-inbox').set('Cookie', `demo_inbox=${encodeURIComponent(legacy)}`).expect(200);
    expect(res.body.messages).toEqual([]);
  });
});
