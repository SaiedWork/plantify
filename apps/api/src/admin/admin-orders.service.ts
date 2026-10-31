import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canTransition,
  type Address,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type AdminOrderQuery,
  type OrderStatus,
  type Page,
} from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { offsetOf } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';
import { WebhookDispatcher } from '../webhooks/webhook-dispatcher.service.js';

@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly audit: AuditService,
    private readonly webhooks: WebhookDispatcher,
  ) {}

  async list(query: AdminOrderQuery): Promise<Page<AdminOrderListItem>> {
    const where: SQL[] = [sql`true`];
    if (query.status) where.push(sql`o.status = ${query.status}`);
    if (query.q) {
      const like = '%' + query.q.replace(/[%_\\]/g, '\\$&') + '%';
      where.push(sql`(o.number ilike ${like} or u.email ilike ${like} or u.name ilike ${like})`);
    }

    const { rows } = await this.db.execute<{
      id: string;
      number: string;
      status: OrderStatus;
      total_cents: number;
      placed_at: Date;
      item_count: string;
      user_id: string;
      user_name: string;
      user_email: string;
      total: string;
    }>(sql`
      select o.id, o.number, o.status, o.total_cents, o.placed_at, u.id as user_id, u.name as user_name, u.email as user_email,
        (select coalesce(sum(quantity), 0) from order_item where order_id = o.id) as item_count,
        count(*) over() as total
      from "order" o join "user" u on u.id = o.user_id
      where ${sql.join(where, sql` and `)}
      order by o.placed_at desc
      limit ${query.pageSize} offset ${offsetOf(query.page, query.pageSize)}`);

    return {
      items: rows.map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status,
        totalCents: r.total_cents,
        itemCount: Number(r.item_count),
        placedAt: new Date(r.placed_at).toISOString(),
        customer: { id: r.user_id, name: r.user_name, email: r.user_email },
      })),
      total: rows[0] ? Number(rows[0].total) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<AdminOrderDetail> {
    const { rows } = await this.db.execute<{
      id: string;
      number: string;
      status: OrderStatus;
      subtotal_cents: number;
      shipping_cents: number;
      tax_cents: number;
      total_cents: number;
      currency: string;
      shipping_address: Address;
      placed_at: Date;
      user_id: string;
      user_name: string;
      user_email: string;
    }>(sql`
      select o.*, u.id as user_id, u.name as user_name, u.email as user_email
      from "order" o join "user" u on u.id = o.user_id where o.id = ${id}`);
    const o = rows[0];
    if (!o) throw new NotFoundException('Order not found');

    const [items, payments, invoice, refunds] = await Promise.all([
      this.db.execute<{ product_name: string; variant_label: string; sku: string; unit_price_cents: number; quantity: number; image_url: string | null }>(
        sql`select oi.product_name, oi.variant_label, oi.sku, oi.unit_price_cents, oi.quantity,
          (select i.url from product_image i join product_variant v on v.product_id = i.product_id
            where v.id = oi.variant_id order by i.position limit 1) as image_url
          from order_item oi where oi.order_id = ${id} order by oi.id`,
      ),
      this.db.execute<{ id: string; status: string; card_brand: string | null; card_last4: string | null; failure_reason: string | null; created_at: Date }>(
        sql`select id, status, card_brand, card_last4, failure_reason, created_at from payment where order_id = ${id} order by created_at desc`,
      ),
      this.db.execute<{ number: string; issued_at: Date }>(sql`select number, issued_at from invoice where order_id = ${id}`),
      this.db.execute<{ id: string; amount_cents: number; restock: boolean; reason: string | null; created_at: Date }>(
        sql`select id, amount_cents, restock, reason, created_at from refund where order_id = ${id} order by created_at desc`,
      ),
    ]);

    return {
      id: o.id,
      number: o.number,
      status: o.status,
      totalCents: o.total_cents,
      itemCount: items.rows.reduce((n, i) => n + i.quantity, 0),
      placedAt: new Date(o.placed_at).toISOString(),
      customer: { id: o.user_id, name: o.user_name, email: o.user_email },
      subtotalCents: o.subtotal_cents,
      shippingCents: o.shipping_cents,
      taxCents: o.tax_cents,
      currency: o.currency,
      shippingAddress: o.shipping_address,
      items: items.rows.map((i) => ({
        productName: i.product_name,
        variantLabel: i.variant_label,
        sku: i.sku,
        unitPriceCents: i.unit_price_cents,
        quantity: i.quantity,
        imageUrl: i.image_url,
      })),
      payments: payments.rows.map((p) => ({
        id: p.id,
        status: p.status,
        cardBrand: p.card_brand,
        cardLast4: p.card_last4,
        failureReason: p.failure_reason,
        createdAt: new Date(p.created_at).toISOString(),
      })),
      invoice: invoice.rows[0] ? { number: invoice.rows[0].number, issuedAt: new Date(invoice.rows[0].issued_at).toISOString() } : null,
      refunds: refunds.rows.map((r) => ({
        id: r.id,
        amountCents: r.amount_cents,
        restock: r.restock,
        reason: r.reason,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    };
  }

  /** Fulfilment moves (processing → shipped → delivered) and cancelling never-paid orders. */
  async changeStatus(actorId: string, id: string, target: 'processing' | 'shipped' | 'delivered' | 'cancelled') {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ status: OrderStatus }>(sql`select status from "order" where id = ${id} for update`);
      const current = rows[0]?.status;
      if (!current) throw new NotFoundException('Order not found');

      if (target === 'cancelled' && current !== 'pending_payment') {
        throw new ConflictException('Paid orders are refunded rather than cancelled');
      }
      if (!canTransition(current, target)) {
        throw new ConflictException(`An order that is "${current.replace('_', ' ')}" can't be moved to "${target}"`);
      }

      await tx.execute(sql`update "order" set status = ${target}, updated_at = now() where id = ${id}`);
      if (target === 'cancelled') {
        await tx.execute(sql`
          update payment set status = 'failed', failure_reason = 'order_cancelled'
          where order_id = ${id} and status in ('pending', 'requires_action')`);
      }
      await this.audit.log(actorId, 'order.status', id, { from: current, to: target }, tx);
    });
    if (target === 'shipped') await this.webhooks.emitOrder('order.shipped', id);
    if (target === 'delivered') await this.webhooks.emitOrder('order.delivered', id);
    return this.get(id);
  }

  /** Fake refund of the full amount, optionally putting the items back on the shelf. */
  async refund(actorId: string, id: string, input: { restock: boolean; reason?: string }) {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ status: OrderStatus; total_cents: number }>(
        sql`select status, total_cents from "order" where id = ${id} for update`,
      );
      const order = rows[0];
      if (!order) throw new NotFoundException('Order not found');
      if (!canTransition(order.status, 'refunded')) {
        throw new ConflictException(`An order that is "${order.status.replace('_', ' ')}" can't be refunded`);
      }

      await tx.execute(sql`
        insert into refund (id, order_id, amount_cents, restock, reason, actor_id)
        values (${crypto.randomUUID()}, ${id}, ${order.total_cents}, ${input.restock}, ${input.reason ?? null}, ${actorId})`);

      if (input.restock) {
        const { rows: items } = await tx.execute<{ variant_id: string; quantity: number }>(
          sql`select variant_id, quantity from order_item where order_id = ${id} order by variant_id`,
        );
        for (const item of items) {
          await tx.execute(sql`
            insert into inventory_level (variant_id, on_hand) values (${item.variant_id}, ${item.quantity})
            on conflict (variant_id) do update set on_hand = inventory_level.on_hand + excluded.on_hand, updated_at = now()`);
          await tx.execute(sql`
            insert into inventory_movement (id, variant_id, delta, reason, order_id, actor_id, note)
            values (${crypto.randomUUID()}, ${item.variant_id}, ${item.quantity}, 'return', ${id}, ${actorId}, 'Refund restock')`);
        }
      }

      await tx.execute(sql`update "order" set status = 'refunded', updated_at = now() where id = ${id}`);
      await this.audit.log(actorId, 'order.refund', id, { from: order.status, restock: input.restock, amountCents: order.total_cents }, tx);
    });
    await this.webhooks.emitOrder('order.refunded', id);
    return this.get(id);
  }
}
