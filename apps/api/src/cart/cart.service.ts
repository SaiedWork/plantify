import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { computeTotals, MAX_CART_LINES, MAX_QTY_PER_LINE, type CartLine, type CartView } from '@plantify/contracts';
import { sql } from 'drizzle-orm';
import { InjectDb, type Db } from '../db/db.module.js';

const EMPTY_CART: CartView = { lines: [], itemCount: 0, ...computeTotals(0) };

@Injectable()
export class CartService {
  constructor(@InjectDb() private readonly db: Db) {}

  async view(cartId: string | null): Promise<CartView> {
    if (!cartId) return EMPTY_CART;
    const { rows } = await this.db.execute<{
      variant_id: string;
      slug: string;
      product_name: string;
      label: string;
      sku: string;
      image_url: string | null;
      price_cents: number;
      quantity: number;
      stock: number;
    }>(sql`
      select ci.variant_id, p.slug, p.name as product_name, v.label, v.sku, v.price_cents, ci.quantity,
        (select i.url from product_image i where i.product_id = p.id order by i.position limit 1) as image_url,
        coalesce(l.on_hand, 0) as stock
      from cart_item ci
      join product_variant v on v.id = ci.variant_id
      join product p on p.id = v.product_id
      left join inventory_level l on l.variant_id = v.id
      where ci.cart_id = ${cartId} and p.status = 'active'
      order by ci.id`);

    const lines: CartLine[] = rows.map((r) => ({
      variantId: r.variant_id,
      productSlug: r.slug,
      productName: r.product_name,
      variantLabel: r.label,
      sku: r.sku,
      imageUrl: r.image_url,
      unitPriceCents: r.price_cents,
      quantity: r.quantity,
      stock: r.stock,
      lineTotalCents: r.price_cents * r.quantity,
    }));
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    return { lines, itemCount: lines.reduce((n, l) => n + l.quantity, 0), ...computeTotals(subtotal) };
  }

  async cartExists(cartId: string) {
    const { rows } = await this.db.execute(sql`select 1 from cart where id = ${cartId}`);
    return rows.length > 0;
  }

  async create(): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.execute(sql`insert into cart (id) values (${id})`);
    return id;
  }

  private async stockOf(variantId: string) {
    const { rows } = await this.db.execute<{ stock: number }>(sql`
      select coalesce(l.on_hand, 0) as stock
      from product_variant v
      join product p on p.id = v.product_id and p.status = 'active'
      left join inventory_level l on l.variant_id = v.id
      where v.id = ${variantId}`);
    if (!rows[0]) throw new NotFoundException('That item is no longer available');
    return rows[0].stock;
  }

  async setQuantity(cartId: string, variantId: string, quantity: number, mode: 'add' | 'set') {
    const stock = await this.stockOf(variantId);
    const cap = Math.min(stock, MAX_QTY_PER_LINE);

    const { rows: existing } = await this.db.execute<{ quantity: number; lines: string }>(sql`
      select coalesce((select quantity from cart_item where cart_id = ${cartId} and variant_id = ${variantId}), 0) as quantity,
             (select count(*) from cart_item where cart_id = ${cartId}) as lines`);
    const current = existing[0]?.quantity ?? 0;
    const target = mode === 'add' ? current + quantity : quantity;

    if (target === 0) {
      await this.db.execute(sql`delete from cart_item where cart_id = ${cartId} and variant_id = ${variantId}`);
      return;
    }
    if (current === 0 && Number(existing[0]?.lines ?? 0) >= MAX_CART_LINES) {
      throw new ConflictException(`Your cart can hold at most ${MAX_CART_LINES} different items`);
    }
    if (target > cap) {
      throw new ConflictException(
        stock === 0 ? 'Sorry, that size is sold out' : `Only ${cap} available${cap === MAX_QTY_PER_LINE && stock > cap ? ' per order' : ''}`,
      );
    }

    await this.db.execute(sql`
      insert into cart_item (id, cart_id, variant_id, quantity)
      values (${crypto.randomUUID()}, ${cartId}, ${variantId}, ${target})
      on conflict (cart_id, variant_id) do update set quantity = excluded.quantity`);
    await this.db.execute(sql`update cart set updated_at = now() where id = ${cartId}`);
  }
}
