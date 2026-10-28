import { Injectable, NotFoundException } from '@nestjs/common';
import type { CategorySummary, ProductDetail, ProductList, ProductListQuery } from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

// Whitelisted ORDER BY fragments: sort values are never interpolated from user input.
const ORDER_BY: Record<ProductListQuery['sort'], SQL> = {
  relevance: sql`rank desc, name asc`,
  newest: sql`created_at desc, name asc`,
  price_asc: sql`min_price asc, name asc`,
  price_desc: sql`min_price desc, name asc`,
  name: sql`name asc`,
};

type ListRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category_slug: string;
  category_name: string;
  image_url: string | null;
  min_price: number;
  max_price: number;
  in_stock: boolean;
  total: string;
};

@Injectable()
export class CatalogService {
  constructor(@InjectDb() private readonly db: Db) {}

  async categories(): Promise<CategorySummary[]> {
    const { rows } = await this.db.execute<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      product_count: string;
    }>(sql`
      select c.id, c.slug, c.name, c.description, count(p.id) filter (where p.status = 'active') as product_count
      from category c left join product p on p.category_id = c.id
      group by c.id order by c.sort_order, c.name`);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      productCount: Number(r.product_count),
    }));
  }

  async list(query: ProductListQuery): Promise<ProductList> {
    const { q, category, minPrice, maxPrice, inStock, featured, sort, page, pageSize } = query;

    const where: SQL[] = [sql`p.status = 'active'`];
    if (category) where.push(sql`c.slug = ${category}`);
    if (featured) where.push(sql`p.featured = true`);
    if (q) {
      where.push(
        sql`(p.search @@ websearch_to_tsquery('english', ${q})
          or similarity(p.name, ${q}) > 0.2
          or p.name ilike ${'%' + q.replace(/[%_\\]/g, '\\$&') + '%'})`,
      );
    }

    const having: SQL[] = [];
    if (minPrice !== undefined) having.push(sql`min(v.price_cents) >= ${minPrice}`);
    if (maxPrice !== undefined) having.push(sql`min(v.price_cents) <= ${maxPrice}`);
    if (inStock) having.push(sql`coalesce(sum(l.on_hand), 0) > 0`);

    const rank = q
      ? sql`ts_rank(p.search, websearch_to_tsquery('english', ${q})) + similarity(p.name, ${q})`
      : sql`0`;
    const orderBy = sort === 'relevance' && !q ? ORDER_BY.name : ORDER_BY[sort];

    const { rows } = await this.db.execute<ListRow>(sql`
      with base as (
        select p.id, p.slug, p.name, p.description, p.created_at,
          c.slug as category_slug, c.name as category_name,
          (select i.url from product_image i where i.product_id = p.id order by i.position limit 1) as image_url,
          min(v.price_cents) as min_price, max(v.price_cents) as max_price,
          coalesce(sum(l.on_hand), 0) > 0 as in_stock,
          ${rank} as rank
        from product p
        join category c on c.id = p.category_id
        join product_variant v on v.product_id = p.id
        left join inventory_level l on l.variant_id = v.id
        where ${sql.join(where, sql` and `)}
        group by p.id, c.id
        ${having.length ? sql`having ${sql.join(having, sql` and `)}` : sql``}
      )
      select *, count(*) over() as total from base
      order by ${orderBy}
      limit ${pageSize} offset ${(page - 1) * pageSize}`);

    return {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        category: { slug: r.category_slug, name: r.category_name },
        imageUrl: r.image_url,
        minPriceCents: r.min_price,
        maxPriceCents: r.max_price,
        inStock: r.in_stock,
      })),
      total: rows[0] ? Number(rows[0].total) : 0,
      page,
      pageSize,
    };
  }

  async bySlug(slug: string): Promise<ProductDetail> {
    const { rows } = await this.db.execute<{
      id: string;
      slug: string;
      name: string;
      description: string;
      category_slug: string;
      category_name: string;
    }>(sql`
      select p.id, p.slug, p.name, p.description, c.slug as category_slug, c.name as category_name
      from product p join category c on c.id = p.category_id
      where p.slug = ${slug} and p.status = 'active'`);
    const product = rows[0];
    if (!product) throw new NotFoundException('Product not found');

    const [images, variants] = await Promise.all([
      this.db.execute<{ url: string; alt: string }>(
        sql`select url, alt from product_image where product_id = ${product.id} order by position`,
      ),
      this.db.execute<{
        id: string;
        sku: string;
        label: string;
        price_cents: number;
        low_stock_threshold: number;
        stock: number;
      }>(sql`
        select v.id, v.sku, v.label, v.price_cents, v.low_stock_threshold, coalesce(l.on_hand, 0) as stock
        from product_variant v left join inventory_level l on l.variant_id = v.id
        where v.product_id = ${product.id} order by v.price_cents`),
    ]);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: { slug: product.category_slug, name: product.category_name },
      images: images.rows,
      variants: variants.rows.map((v) => ({
        id: v.id,
        sku: v.sku,
        label: v.label,
        priceCents: v.price_cents,
        stock: v.stock,
        lowStockThreshold: v.low_stock_threshold,
      })),
    };
  }
}
