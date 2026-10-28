import { Injectable } from '@nestjs/common';
import type { DashboardStats, OrderStatus } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

// Revenue counts orders that were paid and not (yet) refunded or cancelled.
const REVENUE = sql`('paid', 'processing', 'shipped', 'delivered')`;

const pair = (current: unknown, previous: unknown) => ({ current: Number(current), previous: Number(previous) });

@Injectable()
export class AdminDashboardService {
  constructor(@InjectDb() private readonly db: Db) {}

  async stats(days: number): Promise<DashboardStats> {
    // All boundaries are UTC midnights so the chart, the KPIs and the previous-period delta line up.
    const bounds = sql`
      select (date_trunc('day', now() at time zone 'utc') - make_interval(days => ${days - 1})) as cur_start,
             (date_trunc('day', now() at time zone 'utc') - make_interval(days => ${2 * days - 1})) as prev_start`;

    const [kpiRes, customersRes, seriesRes, topRes, statusRes, categoryRes] = await Promise.all([
      this.db.execute<Record<string, string>>(sql`
        with b as (${bounds}),
        o as (select o.*, (o.placed_at at time zone 'utc') as placed_utc from "order" o)
        select
          coalesce(sum(total_cents) filter (where status in ${REVENUE} and placed_utc >= b.cur_start), 0) as rev_cur,
          coalesce(sum(total_cents) filter (where status in ${REVENUE} and placed_utc >= b.prev_start and placed_utc < b.cur_start), 0) as rev_prev,
          count(*) filter (where status in ${REVENUE} and placed_utc >= b.cur_start) as ord_cur,
          count(*) filter (where status in ${REVENUE} and placed_utc >= b.prev_start and placed_utc < b.cur_start) as ord_prev,
          coalesce(sum(total_cents) filter (where status = 'refunded' and placed_utc >= b.cur_start), 0) as ref_cur,
          coalesce(sum(total_cents) filter (where status = 'refunded' and placed_utc >= b.prev_start and placed_utc < b.cur_start), 0) as ref_prev
        from o, b where placed_utc >= b.prev_start`),
      this.db.execute<Record<string, string>>(sql`
        with b as (${bounds})
        select
          count(*) filter (where (created_at at time zone 'utc') >= b.cur_start) as cur,
          count(*) filter (where (created_at at time zone 'utc') >= b.prev_start and (created_at at time zone 'utc') < b.cur_start) as prev
        from "user", b where role = 'customer'`),
      this.db.execute<{ date: string; revenue: string; orders: string }>(sql`
        with b as (${bounds})
        select to_char(d, 'YYYY-MM-DD') as date,
               coalesce(sum(o.total_cents), 0) as revenue, count(o.id) as orders
        from b, generate_series(b.cur_start, b.cur_start + make_interval(days => ${days - 1}), interval '1 day') as d
        left join "order" o
          on date_trunc('day', o.placed_at at time zone 'utc') = d and o.status in ${REVENUE}
        group by d order by d`),
      this.db.execute<{ product_id: string; name: string; units: string; revenue: string }>(sql`
        with b as (${bounds})
        select p.id as product_id, p.name, sum(oi.quantity) as units, sum(oi.quantity * oi.unit_price_cents) as revenue
        from order_item oi
        join "order" o on o.id = oi.order_id and o.status in ${REVENUE}
        join product_variant v on v.id = oi.variant_id
        join product p on p.id = v.product_id, b
        where (o.placed_at at time zone 'utc') >= b.cur_start
        group by p.id order by revenue desc limit 5`),
      this.db.execute<{ status: OrderStatus; count: string }>(sql`
        with b as (${bounds})
        select o.status, count(*) as count from "order" o, b
        where (o.placed_at at time zone 'utc') >= b.cur_start group by o.status order by count desc`),
      this.db.execute<{ name: string; revenue: string }>(sql`
        with b as (${bounds})
        select c.name, sum(oi.quantity * oi.unit_price_cents) as revenue
        from order_item oi
        join "order" o on o.id = oi.order_id and o.status in ${REVENUE}
        join product_variant v on v.id = oi.variant_id
        join product p on p.id = v.product_id
        join category c on c.id = p.category_id, b
        where (o.placed_at at time zone 'utc') >= b.cur_start
        group by c.id order by revenue desc`),
    ]);

    const k = kpiRes.rows[0]!;
    const revenue = pair(k.rev_cur, k.rev_prev);
    const orders = pair(k.ord_cur, k.ord_prev);
    const aov = (r: number, o: number) => (o > 0 ? Math.round(r / o) : 0);

    return {
      days,
      kpis: {
        revenueCents: revenue,
        orders,
        averageOrderCents: { current: aov(revenue.current, orders.current), previous: aov(revenue.previous, orders.previous) },
        newCustomers: pair(customersRes.rows[0]!.cur, customersRes.rows[0]!.prev),
        refundedCents: pair(k.ref_cur, k.ref_prev),
      },
      series: seriesRes.rows.map((r) => ({ date: r.date, revenueCents: Number(r.revenue), orders: Number(r.orders) })),
      topProducts: topRes.rows.map((r) => ({ productId: r.product_id, name: r.name, units: Number(r.units), revenueCents: Number(r.revenue) })),
      ordersByStatus: statusRes.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      categoryRevenue: categoryRes.rows.map((r) => ({ name: r.name, revenueCents: Number(r.revenue) })),
    };
  }
}
