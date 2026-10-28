import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, id, tsvector, updatedAt } from './_helpers.js';

export const category = pgTable('category', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const product = pgTable(
  'product',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    categoryId: text('category_id')
      .notNull()
      .references(() => category.id),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('active'),
    featured: boolean('featured').notNull().default(false),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')`,
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('product_search_idx').using('gin', t.search),
    index('product_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    index('product_category_idx').on(t.categoryId),
  ],
);

export const productVariant = pgTable(
  'product_variant',
  {
    id: id(),
    productId: text('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    label: text('label').notNull(), // e.g. "Small pot"
    priceCents: integer('price_cents').notNull(),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    createdAt: createdAt(),
  },
  (t) => [index('variant_product_idx').on(t.productId)],
);

export const productImage = pgTable('product_image', {
  id: id(),
  productId: text('product_id')
    .notNull()
    .references(() => product.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  alt: text('alt').notNull().default(''),
  position: integer('position').notNull().default(0),
});

export const inventoryLevel = pgTable('inventory_level', {
  variantId: text('variant_id')
    .primaryKey()
    .references(() => productVariant.id, { onDelete: 'cascade' }),
  onHand: integer('on_hand').notNull().default(0),
  updatedAt: updatedAt(),
});

export const inventoryMovement = pgTable(
  'inventory_movement',
  {
    id: id(),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariant.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: text('reason', { enum: ['sale', 'restock', 'adjustment', 'return'] }).notNull(),
    orderId: text('order_id'),
    actorId: text('actor_id'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('movement_variant_idx').on(t.variantId, t.createdAt)],
);
