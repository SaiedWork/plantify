import { Injectable, NotFoundException } from '@nestjs/common';
import type { CustomerDetail, CustomerListItem, CustomerQuery, OrderStatus, Page } from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { offsetOf } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';

// Orders that count as real revenue: paid and onwards, but not cancelled/refunded.
const REVENUE_STATUSES = sql`('paid', 'processing', 'shipped', 'delivered')`;

type Row = {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  created_at: Date;
  order_count: string;
  lifetime_cents: string;
};

const toItem = (r: Row): CustomerListItem => ({
  id: r.id,
  name: r.name,
  email: r.email,
  emailVerified: r.email_verified,
  createdAt: new Date(r.created_at).toISOString(),
  orderCount: Number(r.order_count),
  lifetimeCents: Number(r.lifetime_cents),
});

@Injectable()
export class AdminCustomersService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(query: CustomerQuery): Promise<Page<CustomerListItem>> {
    const where: SQL[] = [sql`u.role = 'customer'`];
    if (query.q) {
      const like = '%' + query.q.replace(/[%_\\]/g, '\\$&') + '%';
      where.push(sql`(u.name ilike ${like} or u.email ilike ${like})`);
    }
    const { rows } = await this.db.execute<Row & { total: string }>(sql`
      select u.id, u.name, u.email, u.email_verified, u.created_at,
        count(o.id) filter (where o.status in ${REVENUE_STATUSES}) as order_count,
        coalesce(sum(o.total_cents) filter (where o.status in ${REVENUE_STATUSES}), 0) as lifetime_cents,
        count(*) over() as total
      from "user" u left join "order" o on o.user_id = u.id
      where ${sql.join(where, sql` and `)}
      group by u.id
      order by lifetime_cents desc, u.created_at desc
      limit ${query.pageSize} offset ${offsetOf(query.page, query.pageSize)}`);
    return { items: rows.map(toItem), total: rows[0] ? Number(rows[0].total) : 0, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<CustomerDetail> {
    const { rows } = await this.db.execute<Row>(sql`
      select u.id, u.name, u.email, u.email_verified, u.created_at,
        count(o.id) filter (where o.status in ${REVENUE_STATUSES}) as order_count,
        coalesce(sum(o.total_cents) filter (where o.status in ${REVENUE_STATUSES}), 0) as lifetime_cents
      from "user" u left join "order" o on o.user_id = u.id
      where u.id = ${id} and u.role = 'customer' group by u.id`);
    if (!rows[0]) throw new NotFoundException('Customer not found');

    const orders = await this.db.execute<{ id: string; number: string; status: OrderStatus; total_cents: number; placed_at: Date }>(
      sql`select id, number, status, total_cents, placed_at from "order" where user_id = ${id} order by placed_at desc limit 50`,
    );
    return {
      ...toItem(rows[0]),
      orders: orders.rows.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        totalCents: o.total_cents,
        placedAt: new Date(o.placed_at).toISOString(),
      })),
    };
  }
}
