import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { canTransition, type Address, type OrderDetail, type OrderStatus, type OrderSummary } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

@Injectable()
export class OrdersService {
  constructor(@InjectDb() private readonly db: Db) {}

  async listForUser(userId: string): Promise<OrderSummary[]> {
    const { rows } = await this.db.execute<{
      id: string;
      number: string;
      status: OrderStatus;
      total_cents: number;
      placed_at: Date;
      item_count: string;
    }>(sql`
      select o.id, o.number, o.status, o.total_cents, o.placed_at,
        (select coalesce(sum(quantity), 0) from order_item where order_id = o.id) as item_count
      from "order" o where o.user_id = ${userId} order by o.placed_at desc limit 100`);
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      totalCents: r.total_cents,
      itemCount: Number(r.item_count),
      placedAt: new Date(r.placed_at).toISOString(),
    }));
  }

  /** Customers may only cancel orders that were never paid; paid orders go through support/admin. */
  async cancelUnpaid(userId: string, orderId: string): Promise<{ status: 'cancelled' }> {
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ status: OrderStatus }>(
        sql`select status from "order" where id = ${orderId} and user_id = ${userId} for update`,
      );
      if (!rows[0]) throw new NotFoundException('Order not found');
      if (!canTransition(rows[0].status, 'cancelled') || rows[0].status !== 'pending_payment') {
        throw new ConflictException('Only unpaid orders can be cancelled');
      }
      await tx.execute(sql`update "order" set status = 'cancelled', updated_at = now() where id = ${orderId}`);
      await tx.execute(sql`
        update payment set status = 'failed', failure_reason = 'order_cancelled'
        where order_id = ${orderId} and status in ('pending', 'requires_action')`);
    });
    return { status: 'cancelled' };
  }

  async detailForUser(userId: string, orderId: string): Promise<OrderDetail> {
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
    }>(sql`select * from "order" where id = ${orderId} and user_id = ${userId}`);
    const o = rows[0];
    if (!o) throw new NotFoundException('Order not found');

    const [items, payment, invoice] = await Promise.all([
      this.db.execute<{ product_name: string; variant_label: string; sku: string; unit_price_cents: number; quantity: number }>(
        sql`select product_name, variant_label, sku, unit_price_cents, quantity from order_item where order_id = ${orderId} order by id`,
      ),
      this.db.execute<{ status: string; card_brand: string | null; card_last4: string | null; failure_reason: string | null }>(
        sql`select status, card_brand, card_last4, failure_reason from payment where order_id = ${orderId} order by created_at desc limit 1`,
      ),
      this.db.execute<{ number: string; issued_at: Date }>(sql`select number, issued_at from invoice where order_id = ${orderId}`),
    ]);

    return {
      id: o.id,
      number: o.number,
      status: o.status,
      totalCents: o.total_cents,
      itemCount: items.rows.reduce((n, i) => n + i.quantity, 0),
      placedAt: new Date(o.placed_at).toISOString(),
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
      })),
      payment: payment.rows[0]
        ? {
            status: payment.rows[0].status,
            cardBrand: payment.rows[0].card_brand,
            cardLast4: payment.rows[0].card_last4,
            failureReason: payment.rows[0].failure_reason,
          }
        : null,
      invoice: invoice.rows[0] ? { number: invoice.rows[0].number, issuedAt: new Date(invoice.rows[0].issued_at).toISOString() } : null,
    };
  }
}
