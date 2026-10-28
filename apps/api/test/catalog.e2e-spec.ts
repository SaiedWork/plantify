import '../src/env.js';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';

// Relies on the deterministic seed (`pnpm db:reset`).
describe('Catalog API (e2e)', () => {
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

  it('lists categories with product counts, publicly', async () => {
    const res = await http().get('/api/categories').expect(200);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toMatchObject({ slug: 'indoor-plants', productCount: 12 });
  });

  it('paginates the product list', async () => {
    const res = await http().get('/api/products?pageSize=10&page=2').expect(200);
    expect(res.body).toMatchObject({ total: 42, page: 2, pageSize: 10 });
    expect(res.body.items).toHaveLength(10);
  });

  it('filters by category', async () => {
    const res = await http().get('/api/products?category=herbs').expect(200);
    expect(res.body.total).toBe(6);
    expect(res.body.items.every((p: { category: { slug: string } }) => p.category.slug === 'herbs')).toBe(true);
  });

  it('full-text search ranks the best match first', async () => {
    const res = await http().get('/api/products?q=monstera').expect(200);
    expect(res.body.items[0].slug).toBe('monstera-deliciosa');
  });

  it('search tolerates typos (trigram)', async () => {
    const res = await http().get('/api/products?q=monstara').expect(200);
    expect(res.body.items.map((p: { slug: string }) => p.slug)).toContain('monstera-deliciosa');
  });

  it('treats LIKE wildcards in the query as plain text', async () => {
    const res = await http().get('/api/products?q=%25').expect(200);
    expect(res.body.total).toBe(0);
  });

  it('sorts by price and filters by price range', async () => {
    const asc = await http().get('/api/products?sort=price_asc&pageSize=48').expect(200);
    const prices = asc.body.items.map((p: { minPriceCents: number }) => p.minPriceCents);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);

    const ranged = await http().get('/api/products?minPrice=2000&maxPrice=3000&pageSize=48').expect(200);
    expect(ranged.body.items.every((p: { minPriceCents: number }) => p.minPriceCents >= 2000 && p.minPriceCents <= 3000)).toBe(true);
  });

  it('rejects invalid query params', async () => {
    await http().get('/api/products?pageSize=1000').expect(400);
    await http().get('/api/products?sort=drop_table').expect(400);
  });

  it('returns product detail with variants and stock', async () => {
    const res = await http().get('/api/products/monstera-deliciosa').expect(200);
    expect(res.body).toMatchObject({ slug: 'monstera-deliciosa', category: { slug: 'indoor-plants' } });
    expect(res.body.variants).toHaveLength(3);
    expect(res.body.variants[0]).toEqual(
      expect.objectContaining({ label: expect.any(String), priceCents: expect.any(Number), stock: expect.any(Number) }),
    );
    expect(res.body.images.length).toBeGreaterThan(0);
  });

  it('404s for an unknown product', () => http().get('/api/products/nope').expect(404));
});
