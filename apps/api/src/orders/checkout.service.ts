import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { computeTotals, DAILY_NEW_ORDERS_CAP, type Address, type CardInput, type PayResult } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';
import { MockPaymentProvider } from '../payments/mock-payment.provider.js';
import { WebhookDispatcher } from '../webhooks/webhook-dispatcher.service.js';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly provider: MockPaymentProvider,
    private readonly webhooks: WebhookDispatcher,
  ) {}

  /** Snapshots the cart into a `pending_payment` order. Nothing is reserved or charged yet. */
  async createOrder(userId: string, cartId: string | null, address: Address): Promise<{ orderId: string }> {
    if (!cartId) throw new BadRequestException('Your cart is empty');

    const created = await this.db.transaction(async (tx) => {
      // Serialises order numbering across concurrent checkouts.
      await tx.execute(sql`select pg_advisory_xact_lock(4243)`);

      const { rows: today } = await tx.execute<{ n: number }>(sql`select count(*)::int as n from "order" where created_at > now() - interval '24 hours'`);
      if (today[0]!.n >= DAILY_NEW_ORDERS_CAP) {
        throw new ServiceUnavailableException('The demo has reached its daily order limit. Please try again tomorrow.');
      }

      const { rows: carts } = await tx.execute<{ user_id: string | null }>(sql`select user_id from cart where id = ${cartId} for update`);
      if (!carts[0]) throw new BadRequestException('Your cart is empty');
      if (carts[0].user_id && carts[0].user_id !== userId) throw new ForbiddenException();
      await tx.execute(sql`update cart set user_id = ${userId} where id = ${cartId}`);

      const { rows: lines } = await tx.execute<{
        variant_id: string;
        quantity: number;
        product_name: string;
        label: string;
        sku: string;
        price_cents: number;
        stock: number;
      }>(sql`
        select ci.variant_id, ci.quantity, p.name as product_name, v.label, v.sku, v.price_cents, coalesce(l.on_hand, 0) as stock
        from cart_item ci
        join product_variant v on v.id = ci.variant_id
        join product p on p.id = v.product_id and p.status = 'active'
        left join inventory_level l on l.variant_id = v.id
        where ci.cart_id = ${cartId} order by ci.id`);
      if (lines.length === 0) throw new BadRequestException('Your cart is empty');

      const short = lines.find((l) => l.quantity > l.stock);
      if (short) {
        throw new ConflictException(
          short.stock === 0 ? `${short.product_name} (${short.label}) just sold out` : `Only ${short.stock} of ${short.product_name} (${short.label}) left`,
        );
      }

      const totals = computeTotals(lines.reduce((sum, l) => sum + l.price_cents * l.quantity, 0));
      const { rows: seq } = await tx.execute<{ next: number }>(sql`select coalesce(max(substring(number from '[0-9]+$')::int), 0) + 1 as next from "order"`);
      const number = `PLT-${String(seq[0]!.next).padStart(6, '0')}`;
      const orderId = crypto.randomUUID();

      await tx.execute(sql`
        insert into "order" (id, number, user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents, shipping_address)
        values (${orderId}, ${number}, ${userId}, 'pending_payment', ${totals.subtotalCents}, ${totals.shippingCents},
                ${totals.taxCents}, ${totals.totalCents}, ${JSON.stringify(address)}::jsonb)`);
      for (const l of lines) {
        await tx.execute(sql`
          insert into order_item (id, order_id, variant_id, product_name, variant_label, sku, unit_price_cents, quantity)
          values (${crypto.randomUUID()}, ${orderId}, ${l.variant_id}, ${l.product_name}, ${l.label}, ${l.sku}, ${l.price_cents}, ${l.quantity})`);
      }
      return { orderId };
    });
    await this.webhooks.emitOrder('order.created', created.orderId);
    return created;
  }

  async pay(userId: string, orderId: string, card: CardInput): Promise<PayResult> {
    const { rows } = await this.db.execute<{ status: string; total_cents: number }>(
      sql`select status, total_cents from "order" where id = ${orderId} and user_id = ${userId}`,
    );
    const order = rows[0];
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'pending_payment') throw new ConflictException('This order has already been processed');

    const evaluation = this.provider.authorize(card);
    if (!evaluation.ok) throw new BadRequestException(evaluation.error);

    const paymentId = crypto.randomUUID();
    await this.db.execute(sql`
      insert into payment (id, order_id, status, amount_cents, card_brand, card_last4)
      values (${paymentId}, ${orderId}, ${evaluation.outcome === 'requires_action' ? 'requires_action' : 'pending'},
              ${order.total_cents}, ${evaluation.brand}, ${evaluation.last4})`);

    if (evaluation.outcome === 'requires_action') return { status: 'requires_action', orderId, paymentId };

    if (evaluation.outcome === 'declined') {
      await this.provider.emit('payment.failed', { paymentId, orderId, failureReason: evaluation.failureReason });
    } else {
      await this.provider.emit('payment.succeeded', { paymentId, orderId });
    }
    return this.settle(orderId, paymentId);
  }

  /** The fake 3-D Secure "Approve" button. */
  async confirm(userId: string, paymentId: string): Promise<PayResult> {
    const { rows } = await this.db.execute<{ order_id: string; status: string }>(sql`
      select p.order_id, p.status from payment p join "order" o on o.id = p.order_id
      where p.id = ${paymentId} and o.user_id = ${userId}`);
    const payment = rows[0];
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'requires_action') throw new ConflictException('This payment does not need confirmation');

    await this.provider.emit('payment.succeeded', { paymentId, orderId: payment.order_id });
    return this.settle(payment.order_id, paymentId);
  }

  /** Reads the outcome after the webhook has been processed. */
  private async settle(orderId: string, paymentId: string): Promise<PayResult> {
    const { rows } = await this.db.execute<{ order_status: string; payment_status: string; failure_reason: string | null }>(sql`
      select o.status as order_status, p.status as payment_status, p.failure_reason
      from "order" o join payment p on p.order_id = o.id where o.id = ${orderId} and p.id = ${paymentId}`);
    const r = rows[0];
    if (r?.order_status === 'paid') return { status: 'paid', orderId };
    return { status: 'failed', orderId, reason: r?.failure_reason ?? 'payment_failed' };
  }
}
