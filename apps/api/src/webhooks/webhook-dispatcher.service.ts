import { Injectable, Logger } from '@nestjs/common';
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_SIGNATURE_HEADER,
  type WebhookDeliveryView,
  type WebhookEnvelope,
  type WebhookEventType,
} from '@plantify/contracts';
import { waitUntil } from '@vercel/functions';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';
import { signPayload } from '../payments/signature.js';
import { assertSafeWebhookUrl } from './ssrf.js';

const TIMEOUT_MS = 5000;

type DeliveryRow = {
  id: string;
  endpoint_id: string;
  endpoint_url: string;
  event: string;
  status: WebhookDeliveryView['status'];
  attempts: number;
  response_code: number | null;
  last_error: string | null;
  last_attempt_at: Date | null;
  created_at: Date;
  payload: unknown;
};

export const toDeliveryView = (r: DeliveryRow): WebhookDeliveryView => ({
  id: r.id,
  endpointId: r.endpoint_id,
  endpointUrl: r.endpoint_url,
  event: r.event,
  status: r.status,
  attempts: r.attempts,
  responseCode: r.response_code,
  lastError: r.last_error,
  lastAttemptAt: r.last_attempt_at ? new Date(r.last_attempt_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString(),
  payload: r.payload,
});

export const DELIVERY_SELECT = sql`
  select d.id, d.endpoint_id, e.url as endpoint_url, d.event, d.status, d.attempts, d.response_code,
         d.last_error, d.last_attempt_at, d.created_at, d.payload
  from webhook_delivery d join webhook_endpoint e on e.id = d.endpoint_id`;

/**
 * Transactional-outbox style delivery: every event becomes a `webhook_delivery` row first, then the
 * first attempt runs in the background. Failures are retried by the cron endpoint or a manual resend.
 */
@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(@InjectDb() private readonly db: Db) {}

  /** Keeps the work alive after the HTTP response on Vercel; plain fire-and-forget elsewhere. */
  private background(work: Promise<unknown>) {
    const guarded = work.catch((err) => this.logger.warn(`webhook delivery failed unexpectedly: ${(err as Error).message}`));
    if (process.env.VERCEL) waitUntil(guarded);
  }

  /** Queues the event for every active endpoint subscribed to it. Never throws: webhooks must not break orders. */
  async emit(type: WebhookEventType, data: unknown): Promise<string[]> {
    try {
      const envelope: WebhookEnvelope = { id: `evt_${crypto.randomUUID()}`, type, createdAt: new Date().toISOString(), data };
      const { rows: endpoints } = await this.db.execute<{ id: string }>(sql`
        select id from webhook_endpoint where active and events @> ${JSON.stringify([type])}::jsonb`);

      const ids: string[] = [];
      for (const endpoint of endpoints) {
        const id = crypto.randomUUID();
        await this.db.execute(sql`
          insert into webhook_delivery (id, endpoint_id, event, payload)
          values (${id}, ${endpoint.id}, ${type}, ${JSON.stringify(envelope)}::jsonb)`);
        ids.push(id);
      }
      if (ids.length > 0) this.background(Promise.allSettled(ids.map((id) => this.deliver(id))));
      return ids;
    } catch (err) {
      this.logger.warn(`could not queue ${type}: ${(err as Error).message}`);
      return [];
    }
  }

  async emitOrder(type: Extract<WebhookEventType, `order.${string}`>, orderId: string) {
    const { rows } = await this.db.execute<{
      id: string;
      number: string;
      status: string;
      total_cents: number;
      currency: string;
      email: string;
      item_count: string;
    }>(sql`
      select o.id, o.number, o.status, o.total_cents, o.currency, u.email,
        (select coalesce(sum(quantity), 0) from order_item where order_id = o.id) as item_count
      from "order" o join "user" u on u.id = o.user_id where o.id = ${orderId}`);
    const o = rows[0];
    if (!o) return [];
    return this.emit(type, {
      orderId: o.id,
      number: o.number,
      status: o.status,
      totalCents: o.total_cents,
      currency: o.currency,
      itemCount: Number(o.item_count),
      customerEmail: o.email,
    });
  }

  /** Emits `inventory.low` for the given variants that sit at or below their threshold. */
  async emitInventoryLow(variantIds: string[]) {
    if (variantIds.length === 0) return;
    const { rows } = await this.db.execute<{ id: string; sku: string; product_name: string; label: string; on_hand: number; threshold: number }>(sql`
      select v.id, v.sku, p.name as product_name, v.label, coalesce(l.on_hand, 0) as on_hand, v.low_stock_threshold as threshold
      from product_variant v join product p on p.id = v.product_id left join inventory_level l on l.variant_id = v.id
      where v.id in (${sql.join(variantIds.map((id) => sql`${id}`), sql`, `)}) and coalesce(l.on_hand, 0) <= v.low_stock_threshold`);
    for (const r of rows) {
      await this.emit('inventory.low', { variantId: r.id, sku: r.sku, productName: r.product_name, variantLabel: r.label, onHand: r.on_hand, threshold: r.threshold });
    }
  }

  /** Test ping for the "send test event" button; delivered inline so the result can be shown. */
  async ping(endpointId: string): Promise<WebhookDeliveryView | null> {
    const envelope: WebhookEnvelope = { id: `evt_${crypto.randomUUID()}`, type: 'ping', createdAt: new Date().toISOString(), data: { message: 'Hello from Plantify' } };
    const id = crypto.randomUUID();
    await this.db.execute(sql`
      insert into webhook_delivery (id, endpoint_id, event, payload)
      values (${id}, ${endpointId}, 'ping', ${JSON.stringify(envelope)}::jsonb)`);
    return this.deliver(id);
  }

  /** One delivery attempt. Always records the outcome; returns the updated row. */
  async deliver(deliveryId: string): Promise<WebhookDeliveryView | null> {
    const { rows } = await this.db.execute<{ payload: unknown; url: string; secret: string; active: boolean; event: string }>(sql`
      select d.payload, d.event, e.url, e.secret, e.active
      from webhook_delivery d join webhook_endpoint e on e.id = d.endpoint_id where d.id = ${deliveryId}`);
    const target = rows[0];
    if (!target) return null;

    let responseCode: number | null = null;
    let error: string | null = null;
    try {
      if (!target.active && target.event !== 'ping') throw new Error('Endpoint is disabled');
      const url = await assertSafeWebhookUrl(target.url); // re-checked each time: DNS can change after saving
      const body = JSON.stringify(target.payload);
      const res = await fetch(url, {
        method: 'POST',
        redirect: 'manual', // never follow redirects into internal addresses
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Plantify-Webhooks/1.0',
          'x-plantify-event': target.event,
          'x-plantify-delivery': deliveryId,
          [WEBHOOK_SIGNATURE_HEADER]: signPayload(body, target.secret),
        },
        body,
      });
      responseCode = res.status;
      if (res.status < 200 || res.status >= 300) error = `Endpoint responded with HTTP ${res.status}`;
    } catch (err) {
      const e = err as Error;
      error = e.name === 'TimeoutError' ? `Timed out after ${TIMEOUT_MS / 1000}s` : e.message;
    }

    await this.db.execute(sql`
      update webhook_delivery set
        attempts = attempts + 1, response_code = ${responseCode}, last_error = ${error},
        status = ${error ? 'failed' : 'delivered'}, last_attempt_at = now()
      where id = ${deliveryId}`);
    const { rows: updated } = await this.db.execute<DeliveryRow>(sql`${DELIVERY_SELECT} where d.id = ${deliveryId}`);
    return updated[0] ? toDeliveryView(updated[0]) : null;
  }

  /** Cron entry point: retries failed/pending deliveries with a growing delay (n² minutes). */
  async retryDue(limit = 50): Promise<{ attempted: number; delivered: number }> {
    const { rows } = await this.db.execute<{ id: string }>(sql`
      select d.id from webhook_delivery d
      where d.status in ('pending', 'failed') and d.attempts < ${WEBHOOK_MAX_ATTEMPTS}
        and (d.last_attempt_at is null or d.last_attempt_at < now() - (interval '1 minute' * d.attempts * d.attempts))
      order by d.created_at limit ${limit}`);
    const results = await Promise.all(rows.map((r) => this.deliver(r.id)));
    return { attempted: rows.length, delivered: results.filter((r) => r?.status === 'delivered').length };
  }
}
