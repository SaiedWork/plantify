import { Injectable } from '@nestjs/common';
import type { PaymentEvent } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';
import { MailService, type ReceiptData } from '../mail/mail.service.js';
import { WebhookDispatcher } from '../webhooks/webhook-dispatcher.service.js';

type HandleResult =
  | { status: 'duplicate' }
  | { status: 'ignored' }
  | { status: 'failed' }
  | { status: 'out_of_stock' }
  | { status: 'paid'; receipt: ReceiptData; orderId: string; crossedLowStock: string[] };

@Injectable()
export class PaymentEventsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly mail: MailService,
    private readonly webhooks: WebhookDispatcher,
  ) {}

  /** Idempotent: the event id is recorded in the same transaction as its effects. */
  async handle(event: PaymentEvent): Promise<HandleResult> {
    const result = await this.db.transaction(async (tx) => {
      const inserted = await tx.execute(sql`
        insert into webhook_event_inbox (event_id, type, payload)
        values (${event.id}, ${event.type}, ${JSON.stringify(event)}::jsonb)
        on conflict (event_id) do nothing returning event_id`);
      if (inserted.rows.length === 0) return { status: 'duplicate' } as HandleResult;

      const { paymentId, orderId, failureReason } = event.data;

      if (event.type === 'payment.failed') {
        await tx.execute(sql`
          update payment set status = 'failed', failure_reason = ${failureReason ?? 'card_declined'}
          where id = ${paymentId} and order_id = ${orderId} and status in ('pending', 'requires_action')`);
        return { status: 'failed' } as HandleResult;
      }

      // Serialises invoice numbering; released when the transaction ends.
      await tx.execute(sql`select pg_advisory_xact_lock(4242)`);

      const { rows: orders } = await tx.execute<{
        id: string;
        number: string;
        status: string;
        user_id: string | null;
        cart_id: string | null;
        subtotal_cents: number;
        shipping_cents: number;
        tax_cents: number;
        total_cents: number;
        contact_email: string;
      }>(sql`
        select o.id, o.number, o.status, o.user_id, o.cart_id, o.subtotal_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.contact_email
        from "order" o
        where o.id = ${orderId} for update of o`);
      const order = orders[0];
      if (!order || order.status !== 'pending_payment') return { status: 'ignored' } as HandleResult;

      const { rows: items } = await tx.execute<{
        variant_id: string;
        quantity: number;
        product_name: string;
        variant_label: string;
        unit_price_cents: number;
      }>(sql`
        select variant_id, quantity, product_name, variant_label, unit_price_cents
        from order_item where order_id = ${orderId} order by variant_id`);

      // Lock stock rows in a stable order so concurrent checkouts cannot deadlock.
      const ids = items.map((i) => sql`${i.variant_id}`);
      const { rows: levels } = await tx.execute<{ variant_id: string; on_hand: number; threshold: number }>(sql`
        select l.variant_id, l.on_hand, v.low_stock_threshold as threshold
        from inventory_level l join product_variant v on v.id = l.variant_id
        where l.variant_id in (${sql.join(ids, sql`, `)}) order by l.variant_id for update of l`);
      const onHand = new Map(levels.map((l) => [l.variant_id, l.on_hand]));
      // Variants this order pushes from "fine" to "low", for the inventory.low webhook.
      const crossedLowStock = items
        .filter((i) => {
          const level = levels.find((l) => l.variant_id === i.variant_id);
          return level !== undefined && level.on_hand > level.threshold && level.on_hand - i.quantity <= level.threshold;
        })
        .map((i) => i.variant_id);

      if (items.some((i) => (onHand.get(i.variant_id) ?? 0) < i.quantity)) {
        await tx.execute(sql`update "order" set status = 'cancelled', updated_at = now() where id = ${orderId}`);
        await tx.execute(sql`update payment set status = 'failed', failure_reason = 'out_of_stock' where id = ${paymentId}`);
        return { status: 'out_of_stock' } as HandleResult;
      }

      for (const item of items) {
        await tx.execute(sql`update inventory_level set on_hand = on_hand - ${item.quantity}, updated_at = now() where variant_id = ${item.variant_id}`);
        await tx.execute(sql`
          insert into inventory_movement (id, variant_id, delta, reason, order_id)
          values (${crypto.randomUUID()}, ${item.variant_id}, ${-item.quantity}, 'sale', ${orderId})`);
      }

      const year = new Date().getFullYear();
      const { rows: seq } = await tx.execute<{ next: number }>(sql`
        select coalesce(max(substring(number from '[0-9]+$')::int), 0) + 1 as next
        from invoice where number like ${`PLT-${year}-%`}`);
      const invoiceNumber = `PLT-${year}-${String(seq[0]!.next).padStart(4, '0')}`;

      await tx.execute(sql`update "order" set status = 'paid', updated_at = now() where id = ${orderId}`);
      await tx.execute(sql`update payment set status = 'succeeded' where id = ${paymentId}`);
      await tx.execute(sql`insert into invoice (id, number, order_id, total_cents) values (${crypto.randomUUID()}, ${invoiceNumber}, ${orderId}, ${order.total_cents})`);
      if (order.cart_id) {
        await tx.execute(sql`delete from cart_item where cart_id = ${order.cart_id}`);
      } else if (order.user_id) {
        await tx.execute(sql`delete from cart_item where cart_id in (select id from cart where user_id = ${order.user_id})`);
      }

      return {
        status: 'paid',
        orderId,
        crossedLowStock,
        receipt: {
          to: order.contact_email,
          orderId: order.id,
          orderNumber: order.number,
          invoiceNumber,
          items: items.map((i) => ({
            name: i.product_name,
            label: i.variant_label,
            quantity: i.quantity,
            unitPriceCents: i.unit_price_cents,
          })),
          subtotalCents: order.subtotal_cents,
          shippingCents: order.shipping_cents,
          taxCents: order.tax_cents,
          totalCents: order.total_cents,
        },
      } as HandleResult;
    });

    // Outside the transaction: a mail problem must never undo a captured payment.
    if (result.status === 'paid') {
      await this.mail.sendReceipt(result.receipt);
      await this.webhooks.emitOrder('order.paid', result.orderId);
      await this.webhooks.emitInventoryLow(result.crossedLowStock);
    }
    return result;
  }
}
