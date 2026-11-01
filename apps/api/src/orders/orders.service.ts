import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { canTransition, type Address, type OrderStatus, type OrderSummary, type TrackedOrder } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';
import { MailService } from '../mail/mail.service.js';
import { ownedBy, type Buyer } from './buyer.js';
import { signOrderLink, verifyOrderLink } from './guest-access.js';

@Injectable()
export class OrdersService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly mail: MailService,
  ) {}

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

  /** The order's contact email, if this buyer may act on it (used to open the right demo inbox). */
  async contactEmailFor(buyer: Buyer, orderId: string): Promise<string | null> {
    const { rows } = await this.db.execute<{ contact_email: string }>(
      sql`select o.contact_email from "order" o where o.id = ${orderId} and ${ownedBy(buyer)}`,
    );
    return rows[0]?.contact_email ?? null;
  }

  async detailForBuyer(buyer: Buyer, orderId: string): Promise<TrackedOrder> {
    const { rows } = await this.db.execute(sql`select 1 from "order" o where o.id = ${orderId} and ${ownedBy(buyer)}`);
    if (rows.length === 0) throw new NotFoundException('Order not found');
    return { ...(await this.load(orderId)), trackToken: signOrderLink(orderId).token };
  }

  /** The public tracking page: a signed link from the confirmation email, valid for ORDER_LINK_HOURS. */
  async detailForLink(token: string): Promise<TrackedOrder> {
    const link = verifyOrderLink(token);
    if (!link.ok) {
      if (link.reason === 'expired') throw new GoneException({ message: 'This link has expired', code: 'link_expired' });
      throw new NotFoundException('Order not found');
    }
    return this.load(link.orderId);
  }

  /** Emails a fresh link when the order number and email match. Returns whether they did, for the caller to open the inbox. */
  async sendLink(orderNumber: string, email: string): Promise<boolean> {
    const { rows } = await this.db.execute<{ id: string; number: string; contact_email: string }>(
      sql`select id, number, contact_email from "order" where number = ${orderNumber} and lower(contact_email) = ${email.toLowerCase()}`,
    );
    const order = rows[0];
    if (!order) return false;
    await this.mail.sendOrderLink(order.contact_email, order.id, order.number);
    return true;
  }

  private async load(orderId: string): Promise<TrackedOrder> {
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
      user_id: string | null;
      contact_email: string;
    }>(sql`select * from "order" where id = ${orderId}`);
    const o = rows[0];
    if (!o) throw new NotFoundException('Order not found');

    const [items, payment, invoice, events] = await Promise.all([
      this.db.execute<{ product_name: string; variant_label: string; sku: string; unit_price_cents: number; quantity: number; image_url: string | null }>(
        sql`select oi.product_name, oi.variant_label, oi.sku, oi.unit_price_cents, oi.quantity,
          (select i.url from product_image i join product_variant v on v.product_id = i.product_id
            where v.id = oi.variant_id order by i.position limit 1) as image_url
          from order_item oi where oi.order_id = ${orderId} order by oi.id`,
      ),
      this.db.execute<{ status: string; card_brand: string | null; card_last4: string | null; failure_reason: string | null }>(
        sql`select status, card_brand, card_last4, failure_reason from payment where order_id = ${orderId} order by created_at desc limit 1`,
      ),
      this.db.execute<{ number: string; issued_at: Date }>(sql`select number, issued_at from invoice where order_id = ${orderId}`),
      this.db.execute<{ status: OrderStatus; created_at: Date }>(
        sql`select status, created_at from order_event where order_id = ${orderId} order by created_at, id`,
      ),
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
      contactEmail: o.contact_email,
      guest: o.user_id === null,
      events: events.rows.map((e) => ({ status: e.status, at: new Date(e.created_at).toISOString() })),
      items: items.rows.map((i) => ({
        productName: i.product_name,
        variantLabel: i.variant_label,
        sku: i.sku,
        unitPriceCents: i.unit_price_cents,
        quantity: i.quantity,
        imageUrl: i.image_url,
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
