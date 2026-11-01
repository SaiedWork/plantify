import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { WEBHOOK_ECHO_URL, type DeliveryQuery, type Page, type WebhookDeliveryView, type WebhookEndpointInput, type WebhookEndpointView, type WebhookEventType } from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service.js';
import { offsetOf } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';
import { assertSafeWebhookUrl } from './ssrf.js';
import { DELIVERY_SELECT, toDeliveryView, WebhookDispatcher } from './webhook-dispatcher.service.js';

type EndpointRow = {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  created_at: Date;
  delivered: string;
  failed: string;
  pending: string;
};

const toEndpoint = (r: EndpointRow): WebhookEndpointView => ({
  id: r.id,
  url: r.url,
  secret: r.secret,
  events: r.events,
  active: r.active,
  createdAt: new Date(r.created_at).toISOString(),
  stats: { delivered: Number(r.delivered), failed: Number(r.failed), pending: Number(r.pending) },
});

const MAX_ENDPOINTS = 5;

@Injectable()
export class AdminWebhooksService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly dispatcher: WebhookDispatcher,
    private readonly audit: AuditService,
  ) {}

  private async checkUrl(url: string) {
    try {
      await assertSafeWebhookUrl(url);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  async listEndpoints(): Promise<WebhookEndpointView[]> {
    const { rows } = await this.db.execute<EndpointRow>(sql`
      select e.id, e.url, e.secret, e.events, e.active, e.created_at,
        count(d.id) filter (where d.status = 'delivered') as delivered,
        count(d.id) filter (where d.status = 'failed') as failed,
        count(d.id) filter (where d.status = 'pending') as pending
      from webhook_endpoint e left join webhook_delivery d on d.endpoint_id = e.id
      group by e.id order by e.created_at`);
    return rows.map(toEndpoint);
  }

  private async endpoint(id: string): Promise<WebhookEndpointView> {
    const found = (await this.listEndpoints()).find((e) => e.id === id);
    if (!found) throw new NotFoundException('Endpoint not found');
    return found;
  }

  async createEndpoint(actorId: string, input: WebhookEndpointInput): Promise<WebhookEndpointView> {
    await this.checkUrl(input.url);
    const { rows } = await this.db.execute<{ n: string }>(sql`select count(*) as n from webhook_endpoint where url <> ${WEBHOOK_ECHO_URL}`);
    if (Number(rows[0]!.n) >= MAX_ENDPOINTS) throw new BadRequestException(`You can register at most ${MAX_ENDPOINTS} endpoints`);

    const id = crypto.randomUUID();
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    await this.db.execute(sql`
      insert into webhook_endpoint (id, url, secret, events, active)
      values (${id}, ${input.url}, ${secret}, ${JSON.stringify(input.events)}::jsonb, ${input.active})`);
    await this.audit.log(actorId, 'webhook.create', id, { url: input.url, events: input.events });
    return this.endpoint(id);
  }

  async updateEndpoint(actorId: string, id: string, patch: Partial<WebhookEndpointInput>): Promise<WebhookEndpointView> {
    if (patch.url !== undefined) {
      if ((await this.endpoint(id)).url === WEBHOOK_ECHO_URL) throw new BadRequestException('The built-in endpoint cannot change its URL');
      await this.checkUrl(patch.url);
    }
    const sets: SQL[] = [];
    if (patch.url !== undefined) sets.push(sql`url = ${patch.url}`);
    if (patch.events !== undefined) sets.push(sql`events = ${JSON.stringify(patch.events)}::jsonb`);
    if (patch.active !== undefined) sets.push(sql`active = ${patch.active}`);
    if (sets.length === 0) throw new BadRequestException('Nothing to update');
    const res = await this.db.execute(sql`update webhook_endpoint set ${sql.join(sets, sql`, `)} where id = ${id} returning id`);
    if (res.rows.length === 0) throw new NotFoundException('Endpoint not found');
    await this.audit.log(actorId, 'webhook.update', id, patch);
    return this.endpoint(id);
  }

  async removeEndpoint(actorId: string, id: string): Promise<void> {
    if ((await this.endpoint(id)).url === WEBHOOK_ECHO_URL) throw new BadRequestException('The built-in endpoint cannot be deleted, only paused');
    const res = await this.db.execute(sql`delete from webhook_endpoint where id = ${id} returning id`);
    if (res.rows.length === 0) throw new NotFoundException('Endpoint not found');
    await this.audit.log(actorId, 'webhook.delete', id);
  }

  async test(actorId: string, id: string): Promise<WebhookDeliveryView> {
    await this.endpoint(id);
    const delivery = await this.dispatcher.ping(id);
    await this.audit.log(actorId, 'webhook.test', id);
    return delivery!;
  }

  async listDeliveries(query: DeliveryQuery): Promise<Page<WebhookDeliveryView>> {
    const where: SQL[] = [sql`true`];
    if (query.endpointId) where.push(sql`d.endpoint_id = ${query.endpointId}`);
    if (query.status) where.push(sql`d.status = ${query.status}`);
    const { rows } = await this.db.execute<Parameters<typeof toDeliveryView>[0] & { total: string }>(sql`
      select x.*, count(*) over() as total from (
        ${DELIVERY_SELECT}
        where ${sql.join(where, sql` and `)}
      ) x
      order by x.created_at desc limit ${query.pageSize} offset ${offsetOf(query.page, query.pageSize)}`);
    return { items: rows.map(toDeliveryView), total: rows[0] ? Number(rows[0].total) : 0, page: query.page, pageSize: query.pageSize };
  }

  async retry(actorId: string, deliveryId: string): Promise<WebhookDeliveryView> {
    const delivery = await this.dispatcher.deliver(deliveryId);
    if (!delivery) throw new NotFoundException('Delivery not found');
    await this.audit.log(actorId, 'webhook.resend', deliveryId);
    return delivery;
  }
}
