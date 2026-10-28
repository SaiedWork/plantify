import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdjustStockInput, InventoryQuery, InventoryRow, Page, StockMovement } from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { offsetOf } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';
import { WebhookDispatcher } from '../webhooks/webhook-dispatcher.service.js';

type Row = {
  variant_id: string;
  product_id: string;
  product_name: string;
  label: string;
  sku: string;
  on_hand: number;
  low_stock_threshold: number;
};

const toRow = (r: Row): InventoryRow => ({
  variantId: r.variant_id,
  productId: r.product_id,
  productName: r.product_name,
  label: r.label,
  sku: r.sku,
  onHand: r.on_hand,
  lowStockThreshold: r.low_stock_threshold,
  isLow: r.on_hand <= r.low_stock_threshold,
});

@Injectable()
export class AdminInventoryService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly audit: AuditService,
    private readonly webhooks: WebhookDispatcher,
  ) {}

  async list(query: InventoryQuery): Promise<Page<InventoryRow>> {
    const where: SQL[] = [sql`true`];
    if (query.lowStock) where.push(sql`coalesce(l.on_hand, 0) <= v.low_stock_threshold`);
    if (query.q) {
      const like = '%' + query.q.replace(/[%_\\]/g, '\\$&') + '%';
      where.push(sql`(p.name ilike ${like} or v.sku ilike ${like})`);
    }

    const { rows } = await this.db.execute<Row & { total: string }>(sql`
      select v.id as variant_id, p.id as product_id, p.name as product_name, v.label, v.sku,
        coalesce(l.on_hand, 0) as on_hand, v.low_stock_threshold, count(*) over() as total
      from product_variant v
      join product p on p.id = v.product_id
      left join inventory_level l on l.variant_id = v.id
      where ${sql.join(where, sql` and `)}
      order by (coalesce(l.on_hand, 0) - v.low_stock_threshold) asc, p.name, v.label
      limit ${query.pageSize} offset ${offsetOf(query.page, query.pageSize)}`);

    return { items: rows.map(toRow), total: rows[0] ? Number(rows[0].total) : 0, page: query.page, pageSize: query.pageSize };
  }

  async adjust(actorId: string, variantId: string, input: AdjustStockInput): Promise<InventoryRow> {
    let crossedLow = false;
    await this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ on_hand: number; threshold: number }>(sql`
        select l.on_hand, v.low_stock_threshold as threshold
        from inventory_level l join product_variant v on v.id = l.variant_id
        where l.variant_id = ${variantId} for update of l`);
      if (!rows[0]) throw new NotFoundException('Variant not found');
      crossedLow = rows[0].on_hand > rows[0].threshold && rows[0].on_hand + input.delta <= rows[0].threshold;
      if (rows[0].on_hand + input.delta < 0) {
        throw new ConflictException(`Only ${rows[0].on_hand} in stock, so you can't remove ${-input.delta}`);
      }
      await tx.execute(sql`update inventory_level set on_hand = on_hand + ${input.delta}, updated_at = now() where variant_id = ${variantId}`);
      await tx.execute(sql`
        insert into inventory_movement (id, variant_id, delta, reason, actor_id, note)
        values (${crypto.randomUUID()}, ${variantId}, ${input.delta}, ${input.reason}, ${actorId}, ${input.note ?? null})`);
      await this.audit.log(actorId, 'inventory.adjust', variantId, { delta: input.delta, reason: input.reason }, tx);
    });
    if (crossedLow) await this.webhooks.emitInventoryLow([variantId]);
    return this.one(variantId);
  }

  private async one(variantId: string): Promise<InventoryRow> {
    const { rows } = await this.db.execute<Row>(sql`
      select v.id as variant_id, p.id as product_id, p.name as product_name, v.label, v.sku,
        coalesce(l.on_hand, 0) as on_hand, v.low_stock_threshold
      from product_variant v join product p on p.id = v.product_id left join inventory_level l on l.variant_id = v.id
      where v.id = ${variantId}`);
    if (!rows[0]) throw new NotFoundException('Variant not found');
    return toRow(rows[0]);
  }

  async movements(variantId: string): Promise<StockMovement[]> {
    await this.one(variantId);
    const { rows } = await this.db.execute<{
      id: string;
      delta: number;
      reason: StockMovement['reason'];
      note: string | null;
      order_id: string | null;
      actor_name: string | null;
      created_at: Date;
    }>(sql`
      select m.id, m.delta, m.reason, m.note, m.order_id, u.name as actor_name, m.created_at
      from inventory_movement m left join "user" u on u.id = m.actor_id
      where m.variant_id = ${variantId} order by m.created_at desc limit 100`);
    return rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      reason: r.reason,
      note: r.note,
      orderId: r.order_id,
      actorName: r.actor_name,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }
}
