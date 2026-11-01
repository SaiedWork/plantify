import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_IMAGES_PER_PRODUCT,
  type AdminProductDetail,
  type AdminProductListItem,
  type AdminProductQuery,
  type CreateProductInput,
  type NewVariantInput,
  type Page,
  type ProductStatus,
} from '@plantify/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { mapDbError, offsetOf, slugify } from '../common/db-errors.js';
import { InjectDb, type Db } from '../db/db.module.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class AdminProductsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminProductQuery): Promise<Page<AdminProductListItem>> {
    const where: SQL[] = [sql`true`];
    if (query.status) where.push(sql`p.status = ${query.status}`);
    if (query.category) where.push(sql`c.slug = ${query.category}`);
    if (query.q) {
      const like = '%' + query.q.replace(/[%_\\]/g, '\\$&') + '%';
      where.push(sql`(p.name ilike ${like} or p.slug ilike ${like})`);
    }

    const { rows } = await this.db.execute<{
      id: string;
      slug: string;
      name: string;
      status: ProductStatus;
      featured: boolean;
      updated_at: Date;
      cat_id: string;
      cat_name: string;
      image_url: string | null;
      variant_count: string;
      stock: string;
      min_price: number;
      total: string;
    }>(sql`
      select p.id, p.slug, p.name, p.status, p.featured, p.updated_at, c.id as cat_id, c.name as cat_name,
        (select i.url from product_image i where i.product_id = p.id order by i.position limit 1) as image_url,
        count(v.id) as variant_count, coalesce(sum(l.on_hand), 0) as stock, coalesce(min(v.price_cents), 0) as min_price,
        count(*) over() as total
      from product p
      join category c on c.id = p.category_id
      left join product_variant v on v.product_id = p.id
      left join inventory_level l on l.variant_id = v.id
      where ${sql.join(where, sql` and `)}
      group by p.id, c.id
      order by p.updated_at desc, p.name
      limit ${query.pageSize} offset ${offsetOf(query.page, query.pageSize)}`);

    return {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        status: r.status,
        featured: r.featured,
        category: { id: r.cat_id, name: r.cat_name },
        imageUrl: r.image_url,
        variantCount: Number(r.variant_count),
        stock: Number(r.stock),
        minPriceCents: r.min_price,
        updatedAt: new Date(r.updated_at).toISOString(),
      })),
      total: rows[0] ? Number(rows[0].total) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<AdminProductDetail> {
    const { rows } = await this.db.execute<{
      id: string;
      slug: string;
      name: string;
      description: string;
      category_id: string;
      status: ProductStatus;
      featured: boolean;
    }>(sql`select id, slug, name, description, category_id, status, featured from product where id = ${id}`);
    const p = rows[0];
    if (!p) throw new NotFoundException('Product not found');

    const [images, variants] = await Promise.all([
      this.db.execute<{ id: string; url: string; alt: string; position: number }>(
        sql`select id, url, alt, position from product_image where product_id = ${id} order by position`,
      ),
      this.db.execute<{ id: string; sku: string; label: string; price_cents: number; low_stock_threshold: number; stock: number }>(sql`
        select v.id, v.sku, v.label, v.price_cents, v.low_stock_threshold, coalesce(l.on_hand, 0) as stock
        from product_variant v left join inventory_level l on l.variant_id = v.id
        where v.product_id = ${id} order by v.price_cents, v.label`),
    ]);

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      categoryId: p.category_id,
      status: p.status,
      featured: p.featured,
      images: images.rows,
      variants: variants.rows.map((v) => ({
        id: v.id,
        sku: v.sku,
        label: v.label,
        priceCents: v.price_cents,
        lowStockThreshold: v.low_stock_threshold,
        stock: v.stock,
      })),
    };
  }

  private async uniqueSlug(tx: Tx, name: string) {
    const base = slugify(name) || 'product';
    for (let n = 1; n < 100; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      const { rows } = await tx.execute(sql`select 1 from product where slug = ${candidate}`);
      if (rows.length === 0) return candidate;
    }
    return `${base}-${crypto.randomUUID().slice(0, 6)}`;
  }

  private async insertVariant(tx: Tx, productId: string, slug: string, v: NewVariantInput, actorId: string) {
    const id = crypto.randomUUID();
    const sku = v.sku ?? `${slug.replace(/-/g, '').slice(0, 6).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    await tx.execute(sql`
      insert into product_variant (id, product_id, sku, label, price_cents, low_stock_threshold)
      values (${id}, ${productId}, ${sku}, ${v.label}, ${v.priceCents}, ${v.lowStockThreshold})`);
    await tx.execute(sql`insert into inventory_level (variant_id, on_hand) values (${id}, ${v.initialStock})`);
    if (v.initialStock > 0) {
      await tx.execute(sql`
        insert into inventory_movement (id, variant_id, delta, reason, actor_id, note)
        values (${crypto.randomUUID()}, ${id}, ${v.initialStock}, 'restock', ${actorId}, 'Opening stock')`);
    }
    return id;
  }

  async create(actorId: string, input: CreateProductInput): Promise<AdminProductDetail> {
    const id = crypto.randomUUID();
    try {
      await this.db.transaction(async (tx) => {
        const slug = await this.uniqueSlug(tx, input.name);
        await tx.execute(sql`
          insert into product (id, slug, name, description, category_id, status, featured)
          values (${id}, ${slug}, ${input.name}, ${input.description}, ${input.categoryId}, ${input.status}, ${input.featured})`);
        for (const v of input.variants) await this.insertVariant(tx, id, slug, v, actorId);
        for (const [position, img] of input.images.entries()) {
          await tx.execute(sql`
            insert into product_image (id, product_id, url, alt, position)
            values (${crypto.randomUUID()}, ${id}, ${img.url}, ${img.alt || input.name}, ${position})`);
        }
        await this.audit.log(actorId, 'product.create', id, { name: input.name, images: input.images.length }, tx);
      });
    } catch (err) {
      mapDbError(err, { unique: 'A SKU in this product is already used by another variant', foreignKey: 'Choose an existing category' });
    }
    return this.get(id);
  }

  async update(
    actorId: string,
    id: string,
    patch: { name?: string; description?: string; categoryId?: string; status?: ProductStatus; featured?: boolean },
  ): Promise<AdminProductDetail> {
    const sets: SQL[] = [];
    if (patch.name !== undefined) sets.push(sql`name = ${patch.name}`);
    if (patch.description !== undefined) sets.push(sql`description = ${patch.description}`);
    if (patch.categoryId !== undefined) sets.push(sql`category_id = ${patch.categoryId}`);
    if (patch.status !== undefined) sets.push(sql`status = ${patch.status}`);
    if (patch.featured !== undefined) sets.push(sql`featured = ${patch.featured}`);
    if (sets.length === 0) throw new BadRequestException('Nothing to update');

    try {
      const res = await this.db.execute(sql`update product set ${sql.join(sets, sql`, `)}, updated_at = now() where id = ${id} returning id`);
      if (res.rows.length === 0) throw new NotFoundException('Product not found');
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      mapDbError(err, { foreignKey: 'Choose an existing category' });
    }
    await this.audit.log(actorId, 'product.update', id, patch);
    return this.get(id);
  }

  async remove(actorId: string, id: string): Promise<void> {
    const { rows } = await this.db.execute<{ ordered: boolean }>(sql`
      select exists (select 1 from order_item oi join product_variant v on v.id = oi.variant_id where v.product_id = ${id}) as ordered`);
    if (rows[0]?.ordered) throw new ConflictException('This product has been ordered, so it cannot be deleted. Archive it instead.');
    const res = await this.db.execute(sql`delete from product where id = ${id} returning id`);
    if (res.rows.length === 0) throw new NotFoundException('Product not found');
    await this.audit.log(actorId, 'product.delete', id);
  }

  // ---- variants --------------------------------------------------------------------------------

  async addVariant(actorId: string, productId: string, input: NewVariantInput): Promise<AdminProductDetail> {
    const { rows } = await this.db.execute<{ slug: string; n: string }>(
      sql`select p.slug, (select count(*) from product_variant where product_id = p.id) as n from product p where p.id = ${productId}`,
    );
    if (!rows[0]) throw new NotFoundException('Product not found');
    if (Number(rows[0].n) >= 10) throw new ConflictException('A product can have at most 10 variants');
    try {
      await this.db.transaction(async (tx) => {
        const variantId = await this.insertVariant(tx, productId, rows[0]!.slug, input, actorId);
        await this.audit.log(actorId, 'variant.create', variantId, { productId, label: input.label }, tx);
      });
    } catch (err) {
      mapDbError(err, { unique: 'That SKU is already in use' });
    }
    await this.db.execute(sql`update product set updated_at = now() where id = ${productId}`);
    return this.get(productId);
  }

  async patchVariant(
    actorId: string,
    variantId: string,
    patch: { label?: string; priceCents?: number; lowStockThreshold?: number; sku?: string },
  ): Promise<AdminProductDetail> {
    const sets: SQL[] = [];
    if (patch.label !== undefined) sets.push(sql`label = ${patch.label}`);
    if (patch.priceCents !== undefined) sets.push(sql`price_cents = ${patch.priceCents}`);
    if (patch.lowStockThreshold !== undefined) sets.push(sql`low_stock_threshold = ${patch.lowStockThreshold}`);
    if (patch.sku !== undefined) sets.push(sql`sku = ${patch.sku}`);
    if (sets.length === 0) throw new BadRequestException('Nothing to update');

    let productId: string | undefined;
    try {
      const res = await this.db.execute<{ product_id: string }>(
        sql`update product_variant set ${sql.join(sets, sql`, `)} where id = ${variantId} returning product_id`,
      );
      productId = res.rows[0]?.product_id;
    } catch (err) {
      mapDbError(err, { unique: 'That SKU is already in use' });
    }
    if (!productId) throw new NotFoundException('Variant not found');
    await this.db.execute(sql`update product set updated_at = now() where id = ${productId}`);
    await this.audit.log(actorId, 'variant.update', variantId, patch);
    return this.get(productId);
  }

  async removeVariant(actorId: string, variantId: string): Promise<AdminProductDetail> {
    const { rows } = await this.db.execute<{ product_id: string; siblings: string; ordered: boolean }>(sql`
      select v.product_id,
        (select count(*) from product_variant where product_id = v.product_id) as siblings,
        exists (select 1 from order_item where variant_id = v.id) as ordered
      from product_variant v where v.id = ${variantId}`);
    const v = rows[0];
    if (!v) throw new NotFoundException('Variant not found');
    if (Number(v.siblings) <= 1) throw new ConflictException('A product needs at least one variant');
    if (v.ordered) throw new ConflictException('This variant appears on past orders and cannot be deleted');
    await this.db.execute(sql`delete from product_variant where id = ${variantId}`);
    await this.audit.log(actorId, 'variant.delete', variantId, { productId: v.product_id });
    return this.get(v.product_id);
  }

  // ---- images ----------------------------------------------------------------------------------

  async addImage(actorId: string, productId: string, url: string, alt: string): Promise<AdminProductDetail> {
    const { rows } = await this.db.execute<{ n: string; next: number }>(sql`
      select count(*) as n, coalesce(max(position), -1) + 1 as next from product_image where product_id = ${productId}`);
    const exists = await this.db.execute(sql`select 1 from product where id = ${productId}`);
    if (exists.rows.length === 0) throw new NotFoundException('Product not found');
    if (Number(rows[0]!.n) >= MAX_IMAGES_PER_PRODUCT) throw new ConflictException(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
    await this.db.execute(sql`
      insert into product_image (id, product_id, url, alt, position)
      values (${crypto.randomUUID()}, ${productId}, ${url}, ${alt}, ${rows[0]!.next})`);
    await this.db.execute(sql`update product set updated_at = now() where id = ${productId}`);
    await this.audit.log(actorId, 'image.add', productId, { url });
    return this.get(productId);
  }

  async removeImage(actorId: string, imageId: string): Promise<AdminProductDetail> {
    const res = await this.db.execute<{ product_id: string }>(sql`delete from product_image where id = ${imageId} returning product_id`);
    const productId = res.rows[0]?.product_id;
    if (!productId) throw new NotFoundException('Image not found');
    await this.audit.log(actorId, 'image.remove', imageId, { productId });
    return this.get(productId);
  }

  async makePrimaryImage(actorId: string, imageId: string): Promise<AdminProductDetail> {
    const { rows } = await this.db.execute<{ product_id: string }>(sql`select product_id from product_image where id = ${imageId}`);
    const productId = rows[0]?.product_id;
    if (!productId) throw new NotFoundException('Image not found');
    await this.db.transaction(async (tx) => {
      const { rows: all } = await tx.execute<{ id: string }>(sql`select id from product_image where product_id = ${productId} order by position`);
      const ordered = [imageId, ...all.map((r) => r.id).filter((id) => id !== imageId)];
      for (const [position, id] of ordered.entries()) {
        await tx.execute(sql`update product_image set position = ${position} where id = ${id}`);
      }
    });
    await this.audit.log(actorId, 'image.primary', imageId, { productId });
    return this.get(productId);
  }
}
