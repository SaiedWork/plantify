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

const ADDRESS = { fullName: 'Admin Test Buyer', line1: '1 Garden Way', city: 'Portland', postalCode: '97201', country: 'US' };
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Admin API (e2e)', () => {
  let app: NestExpressApplication;
  let db: Db;
  const http = () => request(app.getHttpServer());
  const staff = { owner: new Jar(), catalog: new Jar(), orders: new Jar(), customer: new Jar() };
  const as = (jar: Jar) => ({
    get: (url: string) => http().get(url).set('Cookie', jar.header()),
    post: (url: string) => http().post(url).set('Cookie', jar.header()),
    patch: (url: string) => http().patch(url).set('Cookie', jar.header()),
    delete: (url: string) => http().delete(url).set('Cookie', jar.header()),
  });
  const owner = as(staff.owner);
  const catalog = as(staff.catalog);
  const orders = as(staff.orders);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.listen(0);
    process.env.PAYMENT_WEBHOOK_URL = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    db = app.get(DB);

    for (const [jar, email] of [
      [staff.owner, 'owner@plantify.test'],
      [staff.catalog, 'catalog@plantify.test'],
      [staff.orders, 'orders@plantify.test'],
    ] as const) {
      jar.absorb(await http().post('/api/auth/sign-in/email').send({ email, password: DEMO_STAFF_PASSWORD }).expect(200));
    }
    const email = `admin-cust-${crypto.randomUUID().slice(0, 8)}@example.com`;
    staff.customer.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Plain Customer', email, password: 'correct-horse-9' }));
    const inbox = await http().get('/api/demo-inbox').set('Cookie', staff.customer.header());
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    staff.customer.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));
  });

  afterAll(async () => {
    if (createdProducts.length > 0) {
      const ids = sql.join(createdProducts.map((id) => sql`${id}`), sql`, `);
      await db.execute(sql`
        delete from "order" where id in (
          select oi.order_id from order_item oi join product_variant v on v.id = oi.variant_id where v.product_id in (${ids}))`);
      await db.execute(sql`delete from product where id in (${ids})`);
    }
    await app.close();
  });

  // Everything the suite creates is removed afterwards so other suites can rely on the seed data.
  const createdProducts: string[] = [];

  const customerJar = async () => {
    const jar = new Jar();
    const email = `buyer-${crypto.randomUUID().slice(0, 8)}@example.com`;
    jar.absorb(await http().post('/api/auth/sign-up/email').send({ name: 'Order Buyer', email, password: 'correct-horse-9' }));
    const inbox = await http().get('/api/demo-inbox').set('Cookie', jar.header());
    const otp = inbox.body.messages.find((m: { otp?: string }) => m.otp).otp as string;
    jar.absorb(await http().post('/api/auth/email-otp/verify-email').send({ email, otp }));
    return jar;
  };

  /** Creates a fresh active product so these tests never touch stock other suites rely on. */
  async function newProduct(stock = 10, name = `Test Fern ${crypto.randomUUID().slice(0, 6)}`) {
    const categories = await catalog.get('/api/admin/categories').expect(200);
    const res = await catalog
      .post('/api/admin/products')
      .send({
        name,
        description: 'A test plant',
        categoryId: categories.body[0].id,
        status: 'active',
        variants: [{ label: 'Standard', priceCents: 2000, initialStock: stock }],
      })
      .expect(201);
    createdProducts.push(res.body.id);
    return res.body as { id: string; slug: string; variants: { id: string; sku: string }[] };
  }

  async function paidOrder(qty = 2, stock = 10) {
    const product = await newProduct(stock);
    const jar = await customerJar();
    jar.absorb(await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId: product.variants[0]!.id, quantity: qty }));
    const created = await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS }).expect(201);
    const card = { number: '123456789', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123', name: 'Buyer' };
    await http().post(`/api/checkout/orders/${created.body.orderId}/pay`).set('Cookie', jar.header()).send({ card }).expect(201);
    return { orderId: created.body.orderId as string, product, variantId: product.variants[0]!.id };
  }

  const stockOf = async (variantId: string) =>
    (await db.execute<{ on_hand: number }>(sql`select on_hand from inventory_level where variant_id = ${variantId}`)).rows[0]!.on_hand;

  describe('role matrix', () => {
    const endpoints: { path: string; catalogManager: number; orderManager: number; owner: number }[] = [
      { path: '/api/admin/products', catalogManager: 200, orderManager: 403, owner: 200 },
      { path: '/api/admin/categories', catalogManager: 200, orderManager: 403, owner: 200 },
      { path: '/api/admin/inventory', catalogManager: 200, orderManager: 403, owner: 200 },
      { path: '/api/admin/orders', catalogManager: 403, orderManager: 200, owner: 200 },
      { path: '/api/admin/customers', catalogManager: 403, orderManager: 200, owner: 200 },
    ];

    it.each(endpoints)('GET $path: anonymous 401, customer 403, catalog $catalogManager, orders $orderManager, owner $owner', async (e) => {
      await http().get(e.path).expect(401);
      await as(staff.customer).get(e.path).expect(403);
      await catalog.get(e.path).expect(e.catalogManager);
      await orders.get(e.path).expect(e.orderManager);
      await owner.get(e.path).expect(e.owner);
    });

    it('customers cannot write to any admin area', async () => {
      const c = as(staff.customer);
      await c.post('/api/admin/products').send({}).expect(403);
      await c.post('/api/admin/uploads').expect(403);
      await c.post('/api/admin/orders/x/status').send({ status: 'shipped' }).expect(403);
      await c.post('/api/admin/orders/x/refund').send({}).expect(403);
      await c.post('/api/admin/inventory/x/adjust').send({ delta: 1, reason: 'restock' }).expect(403);
    });

    it('refunds are owner-only and customer data is hidden from the catalog manager', async () => {
      await catalog.post('/api/admin/orders/x/refund').send({}).expect(403);
      await orders.post('/api/admin/orders/x/refund').send({}).expect(403);
      await catalog.post('/api/admin/orders/x/status').send({ status: 'processing' }).expect(403);
      await catalog.get('/api/admin/customers/x').expect(403);
    });
  });

  describe('products', () => {
    it('creates, edits and publishes a product; drafts stay hidden from the storefront', async () => {
      const categories = await catalog.get('/api/admin/categories').expect(200);
      const created = await catalog
        .post('/api/admin/products')
        .send({
          name: 'Test Draft Fern',
          description: 'Lovely',
          categoryId: categories.body[0].id,
          variants: [
            { label: 'Small', priceCents: 1200, initialStock: 5 },
            { label: 'Large', priceCents: 2400, initialStock: 0 },
          ],
        })
        .expect(201);
      const p = created.body;
      expect(p).toMatchObject({ name: 'Test Draft Fern', status: 'draft', featured: false });
      expect(p.slug).toMatch(/^test-draft-fern/);
      expect(p.variants).toHaveLength(2);
      expect(p.variants[0].sku).toMatch(/^[A-Z0-9]+-[A-Z0-9]{4}$/);
      expect(p.variants.map((v: { stock: number }) => v.stock).sort((a: number, b: number) => a - b)).toEqual([0, 5]);

      await http().get(`/api/products/${p.slug}`).expect(404); // draft is not public

      const published = await catalog.patch(`/api/admin/products/${p.id}`).send({ status: 'active', featured: true, description: 'Even lovelier' }).expect(200);
      expect(published.body).toMatchObject({ status: 'active', featured: true, description: 'Even lovelier' });
      expect((await http().get(`/api/products/${p.slug}`).expect(200)).body.name).toBe('Test Draft Fern');

      await catalog.patch(`/api/admin/products/${p.id}`).send({ status: 'archived' }).expect(200);
      await http().get(`/api/products/${p.slug}`).expect(404);

      await catalog.delete(`/api/admin/products/${p.id}`).expect(204);
      await catalog.get(`/api/admin/products/${p.id}`).expect(404);
    });

    it('gives duplicate names distinct slugs', async () => {
      const a = await newProduct(1, 'Twin Plant');
      const b = await newProduct(1, 'Twin Plant');
      expect(a.slug).not.toBe(b.slug);
    });

    it('validates input', async () => {
      const categories = await catalog.get('/api/admin/categories').expect(200);
      const base = { name: 'Valid Name', categoryId: categories.body[0].id, variants: [{ label: 'Std', priceCents: 1000 }] };
      await catalog.post('/api/admin/products').send({ ...base, variants: [] }).expect(400);
      await catalog.post('/api/admin/products').send({ ...base, name: 'x' }).expect(400);
      await catalog.post('/api/admin/products').send({ ...base, variants: [{ label: 'Std', priceCents: 1 }] }).expect(400);
      await catalog.post('/api/admin/products').send({ ...base, categoryId: 'nope' }).expect(400);
      await catalog.post('/api/admin/products').send({ ...base, status: 'weird' }).expect(400);
    });

    it('manages variants: add, price change, SKU uniqueness, last-variant protection', async () => {
      const p = await newProduct(3);
      const added = await catalog.post(`/api/admin/products/${p.id}/variants`).send({ label: 'Jumbo', priceCents: 9900, sku: 'JUMBO-TEST-1', initialStock: 2 }).expect(201);
      expect(added.body.variants).toHaveLength(2);

      await catalog.post(`/api/admin/products/${p.id}/variants`).send({ label: 'Dup', priceCents: 1000, sku: 'JUMBO-TEST-1' }).expect(409);

      const jumbo = added.body.variants.find((v: { sku: string }) => v.sku === 'JUMBO-TEST-1');
      const edited = await catalog.patch(`/api/admin/variants/${jumbo.id}`).send({ priceCents: 8800, lowStockThreshold: 1 }).expect(200);
      expect(edited.body.variants.find((v: { id: string }) => v.id === jumbo.id)).toMatchObject({ priceCents: 8800, lowStockThreshold: 1, stock: 2 });

      const afterDelete = await catalog.delete(`/api/admin/variants/${jumbo.id}`).expect(200);
      expect(afterDelete.body.variants).toHaveLength(1);
      await catalog.delete(`/api/admin/variants/${afterDelete.body.variants[0].id}`).expect(409);
    });

    it('refuses to delete a product or variant that appears on orders', async () => {
      const { product, variantId } = await paidOrder(1);
      await catalog.delete(`/api/admin/products/${product.id}`).expect(409);
      // single variant: blocked by the "needs one variant" rule; add another to reach the order-history rule
      const withSecond = await catalog.post(`/api/admin/products/${product.id}/variants`).send({ label: 'Other', priceCents: 1500 }).expect(201);
      expect(withSecond.body.variants).toHaveLength(2);
      await catalog.delete(`/api/admin/variants/${variantId}`).expect(409);
    });

    it('manages images with a 4-image cap and a primary image', async () => {
      const p = await newProduct(1);
      const first = await catalog.post(`/api/admin/products/${p.id}/images`).send({ url: '/products/monstera-deliciosa.svg', alt: 'One' }).expect(201);
      expect(first.body.images).toHaveLength(1);
      const second = await catalog.post(`/api/admin/products/${p.id}/images`).send({ url: 'https://example.com/fern.jpg', alt: 'Two' }).expect(201);

      const secondImage = second.body.images[1];
      const primary = await catalog.post(`/api/admin/images/${secondImage.id}/primary`).expect(200);
      expect(primary.body.images[0].id).toBe(secondImage.id);

      await catalog.post(`/api/admin/products/${p.id}/images`).send({ url: 'http://insecure.example.com/x.jpg' }).expect(400);
      await catalog.post(`/api/admin/products/${p.id}/images`).send({ url: 'javascript:alert(1)' }).expect(400);

      for (let i = 0; i < 2; i++) {
        await catalog.post(`/api/admin/products/${p.id}/images`).send({ url: `/products/aloe-vera.svg` }).expect(201);
      }
      await catalog.post(`/api/admin/products/${p.id}/images`).send({ url: '/products/aloe-vera.svg' }).expect(409);

      const removed = await catalog.delete(`/api/admin/images/${secondImage.id}`).expect(200);
      expect(removed.body.images).toHaveLength(3);
    });

    it('creates a product with its images in one request', async () => {
      const categories = await catalog.get('/api/admin/categories').expect(200);
      const body = (images: unknown[]) => ({
        name: `Imaged Fern ${crypto.randomUUID().slice(0, 6)}`,
        categoryId: categories.body[0].id,
        variants: [{ label: 'Standard', priceCents: 1000 }],
        images,
      });
      const created = await catalog
        .post('/api/admin/products')
        .send(body([{ url: '/products/monstera-deliciosa.svg', alt: 'Cover' }, { url: 'https://example.com/fern.jpg' }]))
        .expect(201);
      expect(created.body.images.map((i: { url: string }) => i.url)).toEqual(['/products/monstera-deliciosa.svg', 'https://example.com/fern.jpg']);
      expect(created.body.images[0]).toMatchObject({ alt: 'Cover', position: 0 });

      const tooMany = Array.from({ length: 5 }, () => ({ url: '/products/aloe-vera.svg' }));
      await catalog.post('/api/admin/products').send(body(tooMany)).expect(400);
      await catalog.post('/api/admin/products').send(body([{ url: 'http://insecure.example.com/x.jpg' }])).expect(400);
    });

    it('lists with search and status filters', async () => {
      const p = await newProduct(1, `Searchable Zebra ${crypto.randomUUID().slice(0, 4)}`);
      const found = await catalog.get('/api/admin/products?q=searchable%20zebra').expect(200);
      expect(found.body.items.some((i: { id: string }) => i.id === p.id)).toBe(true);
      const drafts = await catalog.get('/api/admin/products?status=draft&pageSize=100').expect(200);
      expect(drafts.body.items.every((i: { status: string }) => i.status === 'draft')).toBe(true);
      await catalog.get('/api/admin/products?pageSize=1000').expect(400);
    });
  });

  describe('uploads', () => {
    it('accepts a real image and serves it back', async () => {
      const res = await catalog.post('/api/admin/uploads').attach('file', PNG_1PX, 'tiny.png').expect(201);
      expect(res.body.url).toMatch(/^\/api\/uploads\/[0-9a-f-]+\.png$/);
      await http().get(res.body.url).expect(200);
    });

    it('rejects files that are not images, whatever they are called', async () => {
      await catalog.post('/api/admin/uploads').attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' }).expect(400);
      await catalog.post('/api/admin/uploads').expect(400);
    });

    it('rejects files over 1 MB', async () => {
      const big = Buffer.concat([PNG_1PX, Buffer.alloc(1024 * 1024 + 10)]);
      await catalog.post('/api/admin/uploads').attach('file', big, 'big.png').expect(413);
    });
  });

  describe('categories', () => {
    it('creates, renames, and protects categories that still hold products', async () => {
      const name = `Test Category ${crypto.randomUUID().slice(0, 6)}`;
      const created = await catalog.post('/api/admin/categories').send({ name, description: 'Temp' }).expect(201);
      expect(created.body).toMatchObject({ name, productCount: 0 });
      await catalog.post('/api/admin/categories').send({ name }).expect(409);

      const renamed = await catalog.patch(`/api/admin/categories/${created.body.id}`).send({ description: 'Updated' }).expect(200);
      expect(renamed.body.description).toBe('Updated');

      await catalog.delete(`/api/admin/categories/${created.body.id}`).expect(204);

      const all = await catalog.get('/api/admin/categories').expect(200);
      const indoor = all.body.find((c: { slug: string }) => c.slug === 'indoor-plants');
      expect(indoor.productCount).toBeGreaterThan(0);
      await catalog.delete(`/api/admin/categories/${indoor.id}`).expect(409);
    });
  });

  describe('inventory', () => {
    it('adjusts stock with an audit trail and refuses negative stock', async () => {
      const p = await newProduct(4);
      const variantId = p.variants[0]!.id;

      const up = await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: 6, reason: 'restock', note: 'Delivery from grower' }).expect(200);
      expect(up.body.onHand).toBe(10);
      const down = await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: -3, reason: 'adjustment', note: 'Damaged' }).expect(200);
      expect(down.body.onHand).toBe(7);

      await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: -8, reason: 'adjustment' }).expect(409);
      await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: 0, reason: 'adjustment' }).expect(400);
      await catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: 5, reason: 'sale' }).expect(400);
      await catalog.post(`/api/admin/inventory/nope/adjust`).send({ delta: 1, reason: 'restock' }).expect(404);
      expect(await stockOf(variantId)).toBe(7);

      const history = await catalog.get(`/api/admin/inventory/${variantId}/movements`).expect(200);
      expect(history.body.map((m: { delta: number }) => m.delta)).toEqual([-3, 6, 4]);
      expect(history.body[0]).toMatchObject({ reason: 'adjustment', note: 'Damaged', actorName: 'Steve Catalog' });
    });

    it('does not lose updates under concurrent adjustments', async () => {
      const p = await newProduct(0);
      const variantId = p.variants[0]!.id;
      await Promise.all(Array.from({ length: 10 }, () => catalog.post(`/api/admin/inventory/${variantId}/adjust`).send({ delta: 1, reason: 'restock' }).expect(200)));
      expect(await stockOf(variantId)).toBe(10);
    });

    it('filters low stock', async () => {
      const p = await newProduct(0);
      const low = await catalog.get(`/api/admin/inventory?lowStock=true&q=${encodeURIComponent(p.slug.replace(/-/g, " ").slice(0, 12))}&pageSize=100`).expect(200);
      expect(low.body.items.length).toBeGreaterThan(0);
      expect(low.body.items.every((r: { isLow: boolean }) => r.isLow)).toBe(true);
    });
  });

  describe('orders', () => {
    it('walks an order through fulfilment and rejects invalid moves', async () => {
      const { orderId } = await paidOrder();
      const processing = await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'processing' }).expect(200);
      expect(processing.body.status).toBe('processing');

      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'delivered' }).expect(409); // cannot skip shipped
      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'cancelled' }).expect(409); // paid orders are refunded
      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'paid' }).expect(400);

      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'shipped' }).expect(200);
      const delivered = await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'delivered' }).expect(200);
      expect(delivered.body.status).toBe('delivered');
      await orders.post(`/api/admin/orders/${orderId}/status`).send({ status: 'processing' }).expect(409);

      // The customer sees the new status too.
      const detail = await owner.get(`/api/admin/orders/${orderId}`).expect(200);
      expect(detail.body).toMatchObject({ status: 'delivered', invoice: { number: expect.stringMatching(/^PLT-\d{4}-\d{4}$/) } });
      expect(detail.body.customer.email).toMatch(/@example\.com$/);
    });

    it('cancels a never-paid order', async () => {
      const product = await newProduct(5);
      const jar = await customerJar();
      jar.absorb(await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId: product.variants[0]!.id, quantity: 1 }));
      const { body } = await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS }).expect(201);
      const cancelled = await orders.post(`/api/admin/orders/${body.orderId}/status`).send({ status: 'cancelled' }).expect(200);
      expect(cancelled.body.status).toBe('cancelled');
      await orders.post(`/api/admin/orders/${body.orderId}/status`).send({ status: 'processing' }).expect(409);
    });

    it('owner refunds an order and restocks; a second refund is refused', async () => {
      const { orderId, variantId } = await paidOrder(3, 10);
      expect(await stockOf(variantId)).toBe(7);

      const refunded = await owner.post(`/api/admin/orders/${orderId}/refund`).send({ restock: true, reason: 'Arrived wilted' }).expect(200);
      expect(refunded.body.status).toBe('refunded');
      expect(refunded.body.refunds).toHaveLength(1);
      expect(refunded.body.refunds[0]).toMatchObject({ restock: true, reason: 'Arrived wilted', amountCents: refunded.body.totalCents });
      expect(await stockOf(variantId)).toBe(10);

      await owner.post(`/api/admin/orders/${orderId}/refund`).send({}).expect(409);
      await owner.post(`/api/admin/orders/${orderId}/status`).send({ status: 'shipped' }).expect(409);
    });

    it('refund without restock leaves stock alone; unpaid orders cannot be refunded', async () => {
      const { orderId, variantId } = await paidOrder(2, 10);
      await owner.post(`/api/admin/orders/${orderId}/refund`).send({ restock: false }).expect(200);
      expect(await stockOf(variantId)).toBe(8);

      const product = await newProduct(5);
      const jar = await customerJar();
      jar.absorb(await http().post('/api/cart/items').set('Cookie', jar.header()).send({ variantId: product.variants[0]!.id, quantity: 1 }));
      const pending = await http().post('/api/checkout/orders').set('Cookie', jar.header()).send({ shippingAddress: ADDRESS }).expect(201);
      await owner.post(`/api/admin/orders/${pending.body.orderId}/refund`).send({}).expect(409);
    });

    it('lists and filters orders; unknown orders 404', async () => {
      const { orderId } = await paidOrder();
      const all = await orders.get('/api/admin/orders?pageSize=5').expect(200);
      expect(all.body.items).toHaveLength(5);
      const byStatus = await orders.get('/api/admin/orders?status=refunded&pageSize=100').expect(200);
      expect(byStatus.body.items.every((o: { status: string }) => o.status === 'refunded')).toBe(true);
      const detail = await orders.get(`/api/admin/orders/${orderId}`).expect(200);
      const byNumber = await orders.get(`/api/admin/orders?q=${detail.body.number}`).expect(200);
      expect(byNumber.body.items.map((o: { id: string }) => o.id)).toContain(orderId);
      await orders.get('/api/admin/orders/nope').expect(404);
      await orders.get('/api/admin/orders?status=bogus').expect(400);
    });
  });

  describe('customers', () => {
    it('lists customers with order stats and hides staff accounts', async () => {
      const list = await owner.get('/api/admin/customers?pageSize=100').expect(200);
      expect(list.body.total).toBeGreaterThanOrEqual(60);
      expect(list.body.items.some((c: { email: string }) => c.email.endsWith('@plantify.test'))).toBe(false);

      const top = list.body.items[0];
      expect(top.lifetimeCents).toBeGreaterThan(0);
      const detail = await owner.get(`/api/admin/customers/${top.id}`).expect(200);
      expect(detail.body.id).toBe(top.id);
      expect(detail.body.orders.length).toBeGreaterThan(0);

      const search = await owner.get(`/api/admin/customers?q=${encodeURIComponent(top.email.slice(0, 8))}`).expect(200);
      expect(search.body.items.map((c: { id: string }) => c.id)).toContain(top.id);
    });

    it('does not expose staff through the customer endpoint', async () => {
      const { rows } = await db.execute<{ id: string }>(sql`select id from "user" where email = 'owner@plantify.test'`);
      await owner.get(`/api/admin/customers/${rows[0]!.id}`).expect(404);
    });
  });

  describe('audit log', () => {
    it('records who did what', async () => {
      const p = await newProduct(1);
      await catalog.patch(`/api/admin/products/${p.id}`).send({ featured: true }).expect(200);
      const { rows } = await db.execute<{ action: string; actor: string }>(sql`
        select a.action, u.email as actor from audit_log a join "user" u on u.id = a.actor_id
        where a.target = ${p.id} order by a.created_at`);
      expect(rows).toEqual([
        { action: 'product.create', actor: 'catalog@plantify.test' },
        { action: 'product.update', actor: 'catalog@plantify.test' },
      ]);
    });
  });
});
