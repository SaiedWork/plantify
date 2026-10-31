import { Injectable } from '@nestjs/common';
import { can, type AdminOverview, type OrderStatus, type Role } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

@Injectable()
export class AdminOverviewService {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Role-aware headline counts for the dashboard. Never includes revenue or other money figures. */
  async overview(role: Role, days: number): Promise<AdminOverview> {
    const [catalog, orders, customers] = await Promise.all([
      can(role, 'catalog:manage') ? this.catalog(days) : undefined,
      can(role, 'orders:view') ? this.orders(days) : undefined,
      can(role, 'customers:view') ? this.customers() : undefined,
    ]);
    return { days, ...(catalog && { catalog }), ...(orders && { orders }), ...(customers !== undefined && { customers }) };
  }

  /** UTC midnight of the first day in the range, so charts line up with the owner's dashboard. */
  private start(days: number) {
    return sql`(date_trunc('day', now() at time zone 'utc') - make_interval(days => ${days - 1}))`;
  }

  private async catalog(days: number): Promise<NonNullable<AdminOverview['catalog']>> {
    const [products, categories, stock, series, byCategory, sellers] = await Promise.all([
      this.db.execute<Record<string, string>>(sql`
        select count(*) as total,
               count(*) filter (where status = 'active') as active,
               count(*) filter (where status = 'draft') as draft,
               count(*) filter (where status = 'archived') as archived
        from product`),
      this.db.execute<{ n: string }>(sql`select count(*) as n from category`),
      this.db.execute<Record<string, string>>(sql`
        select count(*) as variants,
               count(*) filter (where coalesce(l.on_hand, 0) = 0) as out_of_stock,
               count(*) filter (where coalesce(l.on_hand, 0) > 0 and coalesce(l.on_hand, 0) <= v.low_stock_threshold) as low_stock
        from product_variant v left join inventory_level l on l.variant_id = v.id`),
      this.db.execute<{ date: string; units: string }>(sql`
        select to_char(d, 'YYYY-MM-DD') as date, coalesce(sum(-m.delta), 0) as units
        from generate_series(${this.start(days)}, ${this.start(days)} + make_interval(days => ${days - 1}), interval '1 day') as d
        left join inventory_movement m on m.reason = 'sale' and date_trunc('day', m.created_at at time zone 'utc') = d
        group by d order by d`),
      this.db.execute<{ name: string; products: string }>(sql`
        select c.name, count(p.id) as products from category c left join product p on p.category_id = c.id
        group by c.id order by products desc, c.name`),
      this.db.execute<{ name: string; units: string }>(sql`
        select p.name, sum(-m.delta) as units
        from inventory_movement m
        join product_variant v on v.id = m.variant_id
        join product p on p.id = v.product_id
        where m.reason = 'sale' and (m.created_at at time zone 'utc') >= ${this.start(days)}
        group by p.id order by units desc limit 5`),
    ]);
    const p = products.rows[0]!;
    const s = stock.rows[0]!;
    return {
      products: Number(p.total),
      active: Number(p.active),
      draft: Number(p.draft),
      archived: Number(p.archived),
      categories: Number(categories.rows[0]!.n),
      variants: Number(s.variants),
      lowStock: Number(s.low_stock),
      outOfStock: Number(s.out_of_stock),
      series: series.rows.map((r) => ({ date: r.date, units: Number(r.units) })),
      productsByCategory: byCategory.rows.map((r) => ({ name: r.name, products: Number(r.products) })),
      bestSellers: sellers.rows.map((r) => ({ name: r.name, units: Number(r.units) })),
    };
  }

  private async orders(days: number): Promise<NonNullable<AdminOverview['orders']>> {
    const [counts, series, byStatus] = await Promise.all([
      this.db.execute<Record<string, string>>(sql`
        select count(*) filter (where status = 'pending_payment') as awaiting_payment,
               count(*) filter (where status = 'paid') as to_process,
               count(*) filter (where status = 'processing') as processing,
               count(*) filter (where status = 'shipped') as shipped,
               count(*) filter (where (placed_at at time zone 'utc') >= date_trunc('day', now() at time zone 'utc')) as placed_today
        from "order"`),
      this.db.execute<{ date: string; orders: string }>(sql`
        select to_char(d, 'YYYY-MM-DD') as date, count(o.id) as orders
        from generate_series(${this.start(days)}, ${this.start(days)} + make_interval(days => ${days - 1}), interval '1 day') as d
        left join "order" o on date_trunc('day', o.placed_at at time zone 'utc') = d
        group by d order by d`),
      this.db.execute<{ status: OrderStatus; count: string }>(sql`
        select status, count(*) as count from "order"
        where (placed_at at time zone 'utc') >= ${this.start(days)}
        group by status order by count desc`),
    ]);
    const r = counts.rows[0]!;
    return {
      awaitingPayment: Number(r.awaiting_payment),
      toProcess: Number(r.to_process),
      processing: Number(r.processing),
      shipped: Number(r.shipped),
      placedToday: Number(r.placed_today),
      series: series.rows.map((x) => ({ date: x.date, orders: Number(x.orders) })),
      byStatus: byStatus.rows.map((x) => ({ status: x.status, count: Number(x.count) })),
    };
  }

  private async customers(): Promise<number> {
    const { rows } = await this.db.execute<{ n: string }>(sql`select count(*) as n from "user" where role = 'customer'`);
    return Number(rows[0]!.n);
  }
}
