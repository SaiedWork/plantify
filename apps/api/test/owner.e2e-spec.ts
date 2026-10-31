import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DEMO_STAFF_PASSWORD } from '@plantify/db';
import { sql } from 'drizzle-orm';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DB, type Db } from './../src/db/db.module.js';
import { Jar } from './support.js';

const ADDRESS = { fullName: 'Dash Buyer', line1: '1 Garden Way', city: 'Portland', postalCode: '97201', country: 'US' };

describe('Dashboard, staff and audit (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;
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
    for (const [jar, email] of [
      [jars.owner, 'owner@plantify.test'],
      [jars.catalog, 'catalog@plantify.test'],
      [jars.orders, 'orders@plantify.test'],
    ] as const) {
      jar.absorb(await http().post('/api/auth/sign-in/email').send({ email, password: DEMO_STAFF_PASSWORD }).expect(200));
    }
  });

  afterAll(async () => {
    // Role swaps are shared state: always leave the seeded staff with their original roles, even after a failure.
    await db.execute(sql`update "user" set role = 'catalog_manager' where email = 'catalog@plantify.test'`);
    await db.execute(sql`update "user" set role = 'order_manager' where email = 'orders@plantify.test'`);
    if (createdProducts.length > 0) {
      const ids = sql.join(createdProducts.map((id) => sql`${id}`), sql`, `);
      await db.execute(sql`
        delete from "order" where id in (
          select oi.order_id from order_item oi join product_variant v on v.id = oi.variant_id where v.product_id in (${ids}))`);
      await db.execute(sql`delete from product where id in (${ids})`);
    }
    await app.close();
  });

  async function verifiedCustomer() {
    const jar = new Jar();
    const email = `owner-suite-${crypto.randomUUID().slice(0, 8)}@example.com`;
    jar.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Future Staffer', email, password: 'correct-horse-9' }));
    const inbox = await http().get('/api/demo-inbox').set('Cookie', jar.header());
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    jar.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));
    const me = await http().get('/api/me').set('Cookie', jar.header()).expect(200);
    return { jar, email, id: me.body.id as string };
  }

  async function staffId(email: string) {
    const list = await owner.get('/api/admin/staff').expect(200);
    return list.body.find((m: { email: string }) => m.email === email).id as string;
  }

  async function paidOrder() {
    const categories = await catalog.get('/api/admin/categories').expect(200);
    const product = (
      await catalog
        .post('/api/admin/products')
        .send({
          name: `Dash Plant ${crypto.randomUUID().slice(0, 6)}`,
          categoryId: categories.body[0].id,
          status: 'active',
          variants: [{ label: 'Standard', priceCents: 4000, initialStock: 20 }],
        })
        .expect(201)
    ).body;
    createdProducts.push(product.id);
    const { jar } = await verifiedCustomer();
    jar.absorb(await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId: product.variants[0].id, quantity: 2 }));
    const { body } = await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS }).expect(201);
    const card = { number: '123456789', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Buyer' };
    await http().post(`/api/checkout/orders/${body.orderId}/pay`).set('Cookie', jar.header()).send({ card }).expect(201);
    const detail = await owner.get(`/api/admin/orders/${body.orderId}`).expect(200);
    return { orderId: body.orderId as string, totalCents: detail.body.totalCents as number };
  }

  describe('sales dashboard', () => {
    it('is owner-only and validates the range', async () => {
      await http().get('/api/admin/dashboard').expect(401);
      await catalog.get('/api/admin/dashboard').expect(403);
      await owner.get('/api/admin/dashboard?days=5').expect(400);
      await owner.get('/api/admin/dashboard?days=abc').expect(400);
      for (const days of [7, 30, 90]) await owner.get(`/api/admin/dashboard?days=${days}`).expect(200);
    });

    it('returns a zero-filled daily series that adds up to the headline numbers', async () => {
      const { body } = await owner.get('/api/admin/dashboard?days=30').expect(200);
      expect(body.days).toBe(30);
      expect(body.series).toHaveLength(30);

      // consecutive UTC days ending today
      const today = new Date().toISOString().slice(0, 10);
      expect(body.series.at(-1).date).toBe(today);
      for (let i = 1; i < body.series.length; i++) {
        const gap = (Date.parse(body.series[i].date) - Date.parse(body.series[i - 1].date)) / 86_400_000;
        expect(gap).toBe(1);
      }

      const sum = (key: 'revenueCents' | 'orders') => body.series.reduce((n: number, d: Record<string, number>) => n + d[key]!, 0);
      expect(sum('revenueCents')).toBe(body.kpis.revenueCents.current);
      expect(sum('orders')).toBe(body.kpis.orders.current);
      expect(body.kpis.revenueCents.current).toBeGreaterThan(0);
      expect(body.kpis.averageOrderCents.current).toBe(Math.round(body.kpis.revenueCents.current / body.kpis.orders.current));
    });

    it('matches an independent SQL calculation', async () => {
      const { body } = await owner.get('/api/admin/dashboard?days=30').expect(200);
      const { rows } = await db.execute<{ rev: string; n: string }>(sql`
        select coalesce(sum(total_cents), 0) as rev, count(*) as n from "order"
        where status in ('paid', 'processing', 'shipped', 'delivered')
          and (placed_at at time zone 'utc') >= date_trunc('day', now() at time zone 'utc') - interval '29 days'`);
      expect(body.kpis.revenueCents.current).toBe(Number(rows[0]!.rev));
      expect(body.kpis.orders.current).toBe(Number(rows[0]!.n));
    });

    it('ranks top products by revenue and breaks sales down by category and status', async () => {
      const { body } = await owner.get('/api/admin/dashboard?days=90').expect(200);
      expect(body.topProducts.length).toBeGreaterThan(0);
      expect(body.topProducts.length).toBeLessThanOrEqual(5);
      const revenues = body.topProducts.map((p: { revenueCents: number }) => p.revenueCents);
      expect(revenues).toEqual([...revenues].sort((a: number, b: number) => b - a));
      expect(body.categoryRevenue.length).toBeGreaterThan(1);
      expect(body.ordersByStatus.map((s: { status: string }) => s.status)).toContain('delivered');
    });

    it('counts a new paid order as revenue and moves it to refunds when refunded', async () => {
      const before = (await owner.get('/api/admin/dashboard?days=7').expect(200)).body.kpis;
      const { orderId, totalCents } = await paidOrder();

      const afterPaid = (await owner.get('/api/admin/dashboard?days=7').expect(200)).body.kpis;
      expect(afterPaid.revenueCents.current - before.revenueCents.current).toBe(totalCents);
      expect(afterPaid.orders.current - before.orders.current).toBe(1);

      await owner.post(`/api/admin/orders/${orderId}/refund`).send({ restock: true }).expect(200);
      const afterRefund = (await owner.get('/api/admin/dashboard?days=7').expect(200)).body.kpis;
      expect(afterRefund.revenueCents.current).toBe(before.revenueCents.current);
      expect(afterRefund.refundedCents.current - before.refundedCents.current).toBe(totalCents);
    });
  });

  describe('overview', () => {
    it('needs a staff session', async () => {
      await http().get('/api/admin/overview').expect(401);
      const customer = await verifiedCustomer();
      await as(customer.jar).get('/api/admin/overview').expect(403);
    });

    it('gives each role only its own counts and never money', async () => {
      const cat = (await catalog.get('/api/admin/overview').expect(200)).body;
      expect(Object.keys(cat).sort()).toEqual(['catalog', 'days']);
      expect(cat.catalog.products).toBeGreaterThan(0);
      expect(cat.catalog.products).toBe(cat.catalog.active + cat.catalog.draft + cat.catalog.archived);
      expect(cat.catalog.categories).toBeGreaterThan(0);
      expect(cat.catalog.outOfStock).toBeGreaterThanOrEqual(0);

      const ord = (await orders.get('/api/admin/overview').expect(200)).body;
      expect(Object.keys(ord).sort()).toEqual(['customers', 'days', 'orders']);
      expect(ord.orders.toProcess).toBeGreaterThanOrEqual(0);
      expect(ord.customers).toBeGreaterThan(0);

      const own = (await owner.get('/api/admin/overview').expect(200)).body;
      expect(Object.keys(own).sort()).toEqual(['catalog', 'customers', 'days', 'orders']);
      expect(JSON.stringify([cat, ord, own])).not.toMatch(/revenue|cents|total/i);
    });

    it('returns zero-filled daily series and chart breakdowns for the requested range', async () => {
      const cat = (await catalog.get('/api/admin/overview?days=7').expect(200)).body;
      expect(cat.days).toBe(7);
      expect(cat.catalog.series).toHaveLength(7);
      expect(cat.catalog.series.every((d: { units: number }) => d.units >= 0)).toBe(true);
      expect(cat.catalog.productsByCategory.reduce((n: number, c: { products: number }) => n + c.products, 0)).toBe(cat.catalog.products);
      expect(cat.catalog.bestSellers.length).toBeLessThanOrEqual(5);

      const ord = (await orders.get('/api/admin/overview?days=90').expect(200)).body;
      expect(ord.orders.series).toHaveLength(90);
      expect(ord.orders.byStatus.reduce((n: number, s: { count: number }) => n + s.count, 0)).toBe(
        ord.orders.series.reduce((n: number, d: { orders: number }) => n + d.orders, 0),
      );

      await catalog.get('/api/admin/overview?days=5').expect(400);
    });

    it('matches the low-stock and out-of-stock counts of the inventory list', async () => {
      const { body } = await catalog.get('/api/admin/overview').expect(200);
      const list = await catalog.get('/api/admin/inventory?lowStock=true&pageSize=100').expect(200);
      expect(list.body.total).toBe(body.catalog.lowStock + body.catalog.outOfStock);
    });
  });

  describe('staff & roles', () => {
    it('is owner-only and lists the three seeded staff with the owner first', async () => {
      await http().get('/api/admin/staff').expect(401);
      await catalog.get('/api/admin/staff').expect(403);
      await orders.get('/api/admin/staff').expect(403);
      const list = await owner.get('/api/admin/staff').expect(200);
      expect(list.body.map((s: { email: string }) => s.email)).toEqual(
        expect.arrayContaining(['owner@plantify.test', 'catalog@plantify.test', 'orders@plantify.test']),
      );
      expect(list.body[0].role).toBe('owner');
    });

    it('gives the order manager orders and customers but not catalog, billing or staff', async () => {
      await orders.get('/api/admin/orders').expect(200);
      await orders.get('/api/admin/customers').expect(200);
      await orders.get('/api/admin/products').expect(403);
      await orders.get('/api/admin/inventory').expect(403);
      await orders.get('/api/admin/dashboard').expect(403);
      await orders.get('/api/admin/audit').expect(403);
    });

    it('swaps roles so each is always held by one person, and the same sessions pick it up', async () => {
      const olga = await staffId('orders@plantify.test');
      const carlos = await staffId('catalog@plantify.test');
      const roleOf = async (email: string) => (await owner.get('/api/admin/staff').expect(200)).body.find((m: { email: string }) => m.email === email).role;
      try {
        await orders.get('/api/admin/products').expect(403);
        const res = await owner.patch(`/api/admin/staff/${olga}`).send({ role: 'catalog_manager' }).expect(200);
        expect(res.body).toMatchObject({ email: 'orders@plantify.test', role: 'catalog_manager' });
        expect(await roleOf('catalog@plantify.test')).toBe('order_manager'); // Steve took Maria's old role
        await orders.get('/api/admin/products').expect(200);
        await orders.get('/api/admin/customers').expect(403);
        await catalog.get('/api/admin/products').expect(403);
        await catalog.get('/api/admin/customers').expect(200);
      } finally {
        await owner.patch(`/api/admin/staff/${carlos}`).send({ role: 'catalog_manager' }).expect(200);
      }
      expect(await roleOf('orders@plantify.test')).toBe('order_manager');
      expect(await roleOf('catalog@plantify.test')).toBe('catalog_manager');
      await orders.get('/api/admin/customers').expect(200);
      await catalog.get('/api/admin/products').expect(200);
    });

    it('never lets the owner role change, and rejects other roles and unknown people', async () => {
      const ownerId = await staffId('owner@plantify.test');
      await owner.patch(`/api/admin/staff/${ownerId}`).send({ role: 'catalog_manager' }).expect(409);
      const catalogId = await staffId('catalog@plantify.test');
      await owner.patch(`/api/admin/staff/${catalogId}`).send({ role: 'owner' }).expect(400);
      await owner.patch(`/api/admin/staff/${catalogId}`).send({ role: 'customer' }).expect(400);
      await owner.patch('/api/admin/staff/nope').send({ role: 'catalog_manager' }).expect(404);
      const customer = await verifiedCustomer();
      await owner.patch(`/api/admin/staff/${customer.id}`).send({ role: 'catalog_manager' }).expect(404); // not staff
    });

    it('no longer has grant or revoke endpoints', async () => {
      await owner.post('/api/admin/staff').send({ email: 'x@example.com', role: 'catalog_manager' }).expect(404);
      await owner.delete('/api/admin/staff/anything').expect(404);
    });
  });

  describe('audit log', () => {
    it('is owner-only', async () => {
      await http().get('/api/admin/audit').expect(401);
      await catalog.get('/api/admin/audit').expect(403);
    });

    it('records staff role changes with who did them, newest first, and can filter by action prefix', async () => {
      const id = await staffId('orders@plantify.test');
      await owner.patch(`/api/admin/staff/${id}`).send({ role: 'catalog_manager' }).expect(200);
      await owner.patch(`/api/admin/staff/${id}`).send({ role: 'order_manager' }).expect(200);

      // Each swap logs both people (same transaction), so two swaps leave four entries.
      const res = await owner.get('/api/admin/audit?action=staff.&pageSize=4').expect(200);
      expect(res.body.items).toHaveLength(4);
      expect(res.body.items.every((e: { action: string }) => e.action === 'staff.role')).toBe(true);
      expect(res.body.items.every((e: { actor: { email: string } }) => e.actor.email === 'owner@plantify.test')).toBe(true);
      expect(res.body.items.map((e: { detail: unknown }) => e.detail)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: 'orders@plantify.test', from: 'catalog_manager', to: 'order_manager' }),
          expect.objectContaining({ email: 'catalog@plantify.test', from: 'order_manager', to: 'catalog_manager' }),
        ]),
      );

      const times = res.body.items.map((e: { createdAt: string }) => Date.parse(e.createdAt));
      expect(times).toEqual([...times].sort((a: number, b: number) => b - a));
    });

    it('filters by actor and pages', async () => {
      const me = await catalog.get('/api/me').expect(200);
      const mine = await owner.get(`/api/admin/audit?actorId=${me.body.id}&pageSize=3`).expect(200);
      expect(mine.body.items.length).toBeGreaterThan(0);
      expect(mine.body.items.every((e: { actor: { email: string } }) => e.actor.email === 'catalog@plantify.test')).toBe(true);
      const page2 = await owner.get(`/api/admin/audit?actorId=${me.body.id}&pageSize=3&page=2`).expect(200);
      expect(page2.body.page).toBe(2);
      expect(page2.body.items.map((e: { id: string }) => e.id)).not.toEqual(expect.arrayContaining(mine.body.items.map((e: { id: string }) => e.id)));
      await owner.get('/api/admin/audit?pageSize=500').expect(400);
    });
  });
});
