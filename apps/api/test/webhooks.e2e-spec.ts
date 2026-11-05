import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WEBHOOK_ECHO_URL } from '@plantify/contracts';
import { DEMO_STAFF_PASSWORD } from '@plantify/db';
import { sql } from 'drizzle-orm';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';
import { verifySignature } from './../src/payments/signature.js';
import { Jar } from './support.js';

const ADDRESS = { fullName: 'Hook Buyer', line1: '1 Garden Way', city: 'Portland', postalCode: '97201', country: 'US' };

type Received = { headers: IncomingHttpHeaders; raw: string; body: { id: string; type: string; createdAt: string; data: Record<string, unknown> } };

/** A tiny HTTP server standing in for the merchant's webhook endpoint. */
function startReceiver() {
  const received: Received[] = [];
  const state = { status: 200 };
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      received.push({ headers: req.headers, raw, body: JSON.parse(raw) });
      res.statusCode = state.status;
      res.end('ok');
    });
  });
  return new Promise<{ url: string; received: Received[]; state: typeof state; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/hook`, received, state, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

async function waitFor<T>(probe: () => T | Promise<T>, ok: (v: T) => boolean, timeoutMs = 6000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await probe();
    if (ok(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting; last value: ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('Outbound webhooks (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;
  const http = () => request(app.getHttpServer());
  const jars = { owner: new Jar(), catalog: new Jar(), orders: new Jar() };
  const as = (jar: Jar) => ({
    get: (url: string) => http().get(url).set('Cookie', jar.header()),
    post: (url: string) => http().post(url).set('Cookie', jar.header()),
    patch: (url: string) => http().patch(url).set('Cookie', jar.header()),
    delete: (url: string) => http().delete(url).set('Cookie', jar.header()),
  });
  const owner = as(jars.owner);
  const catalog = as(jars.catalog);
  const orders = as(jars.orders);
  const createdProducts: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.listen(0);
    process.env.PAYMENT_WEBHOOK_URL = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    db = app.get(DB);
    receiver = await startReceiver();
    await db.execute(sql`delete from webhook_endpoint`); // start from a known state
    for (const [jar, email] of [
      [jars.owner, 'owner@plantify.test'],
      [jars.catalog, 'catalog@plantify.test'],
      [jars.orders, 'orders@plantify.test'],
    ] as const) {
      jar.absorb(await http().post('/api/auth/sign-in/email').send({ email, password: DEMO_STAFF_PASSWORD }).expect(200));
    }
  });

  afterAll(async () => {
    await db.execute(sql`delete from webhook_endpoint`);
    await insertEcho(); // leave the seeded built-in endpoint in place for local dev
    if (createdProducts.length > 0) {
      const ids = sql.join(createdProducts.map((id) => sql`${id}`), sql`, `);
      await db.execute(sql`
        delete from "order" where id in (
          select oi.order_id from order_item oi join product_variant v on v.id = oi.variant_id where v.product_id in (${ids}))`);
      await db.execute(sql`delete from product where id in (${ids})`);
    }
    await receiver.close();
    await app.close();
  });

  beforeEach(async () => {
    receiver.received.length = 0;
    receiver.state.status = 200;
    await db.execute(sql`delete from webhook_endpoint`);
  });

  const insertEcho = async () => {
    const id = crypto.randomUUID();
    await db.execute(sql`
      insert into webhook_endpoint (id, url, secret, events, active)
      values (${id}, ${WEBHOOK_ECHO_URL}, ${`whsec_${'ab'.repeat(24)}`}, ${JSON.stringify(['order.paid', 'order.created'])}::jsonb, true)`);
    return id;
  };

  const register = async (events: string[], over: Record<string, unknown> = {}) =>
    (await owner.post('/api/admin/webhooks/endpoints').send({ url: receiver.url, events, ...over }).expect(201)).body as {
      id: string;
      secret: string;
      url: string;
    };

  async function newProduct(stock: number, threshold = 5) {
    const categories = await catalog.get('/api/admin/categories').expect(200);
    const product = (
      await catalog
        .post('/api/admin/products')
        .send({
          name: `Hook Plant ${crypto.randomUUID().slice(0, 6)}`,
          categoryId: categories.body[0].id,
          status: 'active',
          variants: [{ label: 'Standard', priceCents: 3000, initialStock: stock, lowStockThreshold: threshold }],
        })
        .expect(201)
    ).body;
    createdProducts.push(product.id);
    return { productId: product.id as string, variantId: product.variants[0].id as string };
  }

  async function customerJar() {
    const jar = new Jar();
    const email = `hook-${crypto.randomUUID().slice(0, 8)}@example.com`;
    jar.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Hook Buyer', email, password: 'correct-horse-9' }));
    const inbox = await http().get('/api/demo-inbox').set('Cookie', jar.header());
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    jar.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));
    return { jar, email };
  }

  async function buy(variantId: string, quantity: number) {
    const { jar, email } = await customerJar();
    jar.absorb(await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId, quantity }));
    const { body } = await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS }).expect(201);
    const card = { number: '123456789', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Buyer' };
    await http().post(`/api/checkout/orders/${body.orderId}/pay`).set('Cookie', jar.header()).send({ card }).expect(201);
    return { orderId: body.orderId as string, email };
  }

  const types = () => receiver.received.map((r) => r.body.type).sort((a, b) => a.localeCompare(b));
  const deliveries = async (endpointId?: string) =>
    (await owner.get(`/api/admin/webhooks/deliveries${endpointId ? `?endpointId=${endpointId}` : ''}`).expect(200)).body;

  describe('access and validation', () => {
    it('is owner-only', async () => {
      const paths = ['/api/admin/webhooks/endpoints', '/api/admin/webhooks/deliveries'];
      for (const path of paths) {
        await http().get(path).expect(401);
        await catalog.get(path).expect(403);
        await owner.get(path).expect(200);
      }
      await catalog.post('/api/admin/webhooks/endpoints').send({ url: receiver.url, events: ['order.paid'] }).expect(403);
    });

    it('validates URLs and events', async () => {
      const post = (body: object) => owner.post('/api/admin/webhooks/endpoints').send(body);
      await post({ url: 'not a url', events: ['order.paid'] }).expect(400);
      await post({ url: receiver.url, events: [] }).expect(400);
      await post({ url: receiver.url, events: ['order.exploded'] }).expect(400);
      await post({ url: 'ftp://example.com/x', events: ['order.paid'] }).expect(400);
    });

    it('creates an endpoint with a generated signing secret and caps the number of endpoints', async () => {
      const ep = await register(['order.paid']);
      expect(ep.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
      for (let i = 0; i < 4; i++) await register(['order.paid']);
      await owner.post('/api/admin/webhooks/endpoints').send({ url: receiver.url, events: ['order.paid'] }).expect(400);
    });

    it('edits, disables and deletes endpoints', async () => {
      const ep = await register(['order.paid']);
      const updated = await owner.patch(`/api/admin/webhooks/endpoints/${ep.id}`).send({ events: ['order.shipped', 'order.refunded'], active: false }).expect(200);
      expect(updated.body).toMatchObject({ active: false, events: ['order.shipped', 'order.refunded'] });
      await owner.patch('/api/admin/webhooks/endpoints/nope').send({ active: true }).expect(404);
      await owner.patch(`/api/admin/webhooks/endpoints/${ep.id}`).send({}).expect(400);
      await owner.delete(`/api/admin/webhooks/endpoints/${ep.id}`).expect(204);
      await owner.delete(`/api/admin/webhooks/endpoints/${ep.id}`).expect(404);
    });
  });

  describe('built-in echo endpoint', () => {
    it('delivers events in-process, can be tested and paused, but not re-pointed or deleted', async () => {
      const id = await insertEcho();
      const test = await owner.post(`/api/admin/webhooks/endpoints/${id}/test`).expect(200);
      expect(test.body).toMatchObject({ status: 'delivered', responseCode: 200, lastError: null, endpointUrl: WEBHOOK_ECHO_URL });

      const { variantId } = await newProduct(20);
      await buy(variantId, 1);
      const log = await waitFor(() => deliveries(id), (d) => d.items.some((i: { event: string }) => i.event === 'order.paid'));
      expect(log.items.every((i: { status: string }) => i.status === 'delivered')).toBe(true);

      await owner.patch(`/api/admin/webhooks/endpoints/${id}`).send({ active: false }).expect(200);
      await owner.patch(`/api/admin/webhooks/endpoints/${id}`).send({ url: receiver.url }).expect(400);
      await owner.delete(`/api/admin/webhooks/endpoints/${id}`).expect(400);
      await owner.post('/api/admin/webhooks/endpoints').send({ url: WEBHOOK_ECHO_URL, events: ['order.paid'] }).expect(400);
    });

    it('does not count towards the endpoint cap', async () => {
      await insertEcho();
      for (let i = 0; i < 5; i++) await register(['order.paid']);
      await owner.post('/api/admin/webhooks/endpoints').send({ url: receiver.url, events: ['order.paid'] }).expect(400);
    });
  });

  describe('delivery', () => {
    it('sends signed order.created and order.paid events to a subscribed endpoint', async () => {
      const ep = await register(['order.created', 'order.paid']);
      const { variantId } = await newProduct(20);
      const { orderId, email } = await buy(variantId, 2);

      await waitFor(() => receiver.received.length, (n) => n >= 2);
      expect(types()).toEqual(['order.created', 'order.paid']);

      const paid = receiver.received.find((r) => r.body.type === 'order.paid')!;
      expect(paid.body.data).toMatchObject({ orderId, status: 'paid', itemCount: 2, customerEmail: email, currency: 'USD' });
      expect(paid.body.id).toMatch(/^evt_/);

      // The receiver can verify authenticity with the endpoint's secret.
      expect(verifySignature(Buffer.from(paid.raw), paid.headers['x-plantify-signature'] as string, ep.secret)).toBe(true);
      expect(verifySignature(Buffer.from(paid.raw), paid.headers['x-plantify-signature'] as string, 'whsec_wrong')).toBe(false);
      expect(paid.headers['x-plantify-event']).toBe('order.paid');
      expect(paid.headers['content-type']).toContain('application/json');

      const log = await waitFor(() => deliveries(ep.id), (d) => d.items.length === 2 && d.items.every((i: { status: string }) => i.status === 'delivered'));
      expect(log.items[0]).toMatchObject({ endpointUrl: receiver.url, attempts: 1, responseCode: 200, lastError: null });
      expect(log.items[0].payload.type).toMatch(/^order\./);
    });

    it('only sends events the endpoint subscribed to, and nothing to disabled endpoints', async () => {
      await register(['order.shipped']);
      await register(['order.paid'], { active: false });
      const { variantId } = await newProduct(20);
      await buy(variantId, 1);
      await new Promise((r) => setTimeout(r, 600));
      expect(receiver.received).toHaveLength(0);
    });

    it('fans out to every subscribed endpoint', async () => {
      const a = await register(['order.paid']);
      const b = await register(['order.paid']);
      const { variantId } = await newProduct(20);
      await buy(variantId, 1);
      await waitFor(() => receiver.received.length, (n) => n >= 2);
      const logA = await deliveries(a.id);
      const logB = await deliveries(b.id);
      expect(logA.total).toBe(1);
      expect(logB.total).toBe(1);
    });

    it('emits shipped, delivered and refunded events from admin actions', async () => {
      await register(['order.shipped', 'order.delivered', 'order.refunded']);
      const { variantId } = await newProduct(20);
      const { orderId } = await buy(variantId, 1);
      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'processing' }).expect(200);
      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'shipped' }).expect(200);
      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'delivered' }).expect(200);
      await owner.post(`/api/admin/orders/${orderId}/refund`).send({ restock: false }).expect(200);

      await waitFor(() => receiver.received.length, (n) => n >= 3);
      expect(types()).toEqual(['order.delivered', 'order.refunded', 'order.shipped']);
    });

    it('emits inventory.low once, when stock crosses the threshold (sale or manual adjustment)', async () => {
      await register(['inventory.low']);
      const { variantId } = await newProduct(7, 5);

      await buy(variantId, 1); // 7 -> 6: still above the threshold
      await new Promise((r) => setTimeout(r, 500));
      expect(receiver.received).toHaveLength(0);

      await buy(variantId, 2); // 6 -> 4: crosses
      await waitFor(() => receiver.received.length, (n) => n >= 1);
      expect(receiver.received[0]!.body).toMatchObject({ type: 'inventory.low', data: { variantId, onHand: 4, threshold: 5 } });

      await buy(variantId, 1); // 4 -> 3: already low, no new event
      await new Promise((r) => setTimeout(r, 500));
      expect(receiver.received).toHaveLength(1);

      await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: 10, reason: 'restock' }).expect(200); // back above
      await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: -9, reason: 'adjustment' }).expect(200); // crosses again
      await waitFor(() => receiver.received.length, (n) => n >= 2);
      expect(receiver.received[1]!.body.data).toMatchObject({ onHand: 4 });
    });

    it('sends a test ping and shows the result inline', async () => {
      const ep = await register(['order.paid']);
      const res = await owner.post(`/api/admin/webhooks/endpoints/${ep.id}/test`).expect(200);
      expect(res.body).toMatchObject({ event: 'ping', status: 'delivered', responseCode: 200, attempts: 1 });
      expect(receiver.received).toHaveLength(1);
      expect(receiver.received[0]!.body).toMatchObject({ type: 'ping', data: { message: expect.any(String) } });
      await catalog.post(`/api/admin/webhooks/endpoints/${ep.id}/test`).expect(403);
      await owner.post('/api/admin/webhooks/endpoints/nope/test').expect(404);
    });
  });

  describe('failure and retry', () => {
    it('records failures and lets an owner resend until it succeeds', async () => {
      const ep = await register(['order.paid']);
      receiver.state.status = 500;
      const { variantId } = await newProduct(20);
      await buy(variantId, 1);

      const failed = await waitFor(() => deliveries(ep.id), (d) => d.items[0]?.status === 'failed');
      const delivery = failed.items[0];
      expect(delivery).toMatchObject({ status: 'failed', attempts: 1, responseCode: 500 });
      expect(delivery.lastError).toContain('HTTP 500');

      receiver.state.status = 200;
      const retried = await owner.post(`/api/admin/webhooks/deliveries/${delivery.id}/retry`).expect(200);
      expect(retried.body).toMatchObject({ status: 'delivered', attempts: 2, responseCode: 200, lastError: null });
      await catalog.post(`/api/admin/webhooks/deliveries/${delivery.id}/retry`).expect(403);
      await owner.post('/api/admin/webhooks/deliveries/nope/retry').expect(404);

      const filtered = await owner.get(`/api/admin/webhooks/deliveries?endpointId=${ep.id}&status=failed`).expect(200);
      expect(filtered.body.total).toBe(0);
    });

    it('records connection errors instead of throwing', async () => {
      const ep = await register(['order.paid'], { url: 'http://127.0.0.1:1/unreachable' });
      const res = await owner.post(`/api/admin/webhooks/endpoints/${ep.id}/test`).expect(200);
      expect(res.body).toMatchObject({ status: 'failed', responseCode: null });
      expect(res.body.lastError).toBeTruthy();
    });

    it('lets the cron endpoint retry failed deliveries once their back-off has passed', async () => {
      const ep = await register(['order.paid']);
      receiver.state.status = 500;
      const { variantId } = await newProduct(20);
      await buy(variantId, 1);
      const failed = await waitFor(() => deliveries(ep.id), (d) => d.items[0]?.status === 'failed');
      const id = failed.items[0].id as string;
      receiver.state.status = 200;

      const cron = () => http().post('/api/internal/webhooks/retry');
      await cron().expect(401);
      await cron().set('Authorization', 'Bearer wrong').expect(401);
      const secret = process.env.CRON_SECRET!;

      // Backing off: one attempt so far means one minute before the next.
      const early = await cron().set('Authorization', `Bearer ${secret}`).expect(200);
      expect(early.body.attempted).toBe(0);

      await db.execute(sql`update webhook_delivery set last_attempt_at = now() - interval '10 minutes' where id = ${id}`);
      const due = await cron().set('Authorization', `Bearer ${secret}`).expect(200);
      expect(due.body).toEqual({ attempted: 1, delivered: 1 });
      expect((await deliveries(ep.id)).items[0]).toMatchObject({ id, status: 'delivered', attempts: 2 });
    });

    it('gives up after the maximum number of attempts', async () => {
      const ep = await register(['order.paid']);
      receiver.state.status = 500;
      const res = await owner.post(`/api/admin/webhooks/endpoints/${ep.id}/test`).expect(200);
      await db.execute(sql`update webhook_delivery set attempts = 5, last_attempt_at = now() - interval '1 day' where id = ${res.body.id}`);
      const due = await http().post('/api/internal/webhooks/retry').set('Authorization', `Bearer ${process.env.CRON_SECRET}`).expect(200);
      expect(due.body.attempted).toBe(0);
    });
  });

  describe('safety', () => {
    it('does not follow redirects (so a public URL cannot bounce to an internal one)', async () => {
      const redirector = createServer((_req, res) => {
        res.statusCode = 302;
        res.setHeader('location', receiver.url);
        res.end();
      });
      await new Promise<void>((r) => redirector.listen(0, '127.0.0.1', () => r()));
      const { port } = redirector.address() as AddressInfo;
      const ep = await register(['order.paid'], { url: `http://127.0.0.1:${port}/redirect` });
      const res = await owner.post(`/api/admin/webhooks/endpoints/${ep.id}/test`).expect(200);
      await new Promise<void>((r) => redirector.close(() => r()));

      expect(res.body).toMatchObject({ status: 'failed', responseCode: 302 });
      expect(receiver.received).toHaveLength(0);
    });

    it('removes the delivery log together with its endpoint', async () => {
      const ep = await register(['order.paid']);
      const test = await owner.post(`/api/admin/webhooks/endpoints/${ep.id}/test`).expect(200);
      await owner.delete(`/api/admin/webhooks/endpoints/${ep.id}`).expect(204);
      const { rows } = await db.execute(sql`select 1 from webhook_delivery where id = ${test.body.id}`);
      expect(rows).toHaveLength(0);
    });

    it('records webhook changes in the audit log', async () => {
      const ep = await register(['order.paid']);
      await owner.delete(`/api/admin/webhooks/endpoints/${ep.id}`).expect(204);
      const audit = await owner.get('/api/admin/audit?action=webhook.&pageSize=2').expect(200);
      expect(audit.body.items.map((e: { action: string }) => e.action)).toEqual(['webhook.delete', 'webhook.create']);
    });
  });
});
