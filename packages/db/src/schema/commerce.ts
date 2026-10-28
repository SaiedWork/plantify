import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './_helpers.js';
import { user } from './auth.js';
import { productVariant } from './catalog.js';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export const address = pgTable('address', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  region: text('region'),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull().default('US'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: createdAt(),
});

export const cart = pgTable('cart', {
  id: id(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItem = pgTable(
  'cart_item',
  {
    id: id(),
    cartId: text('cart_id')
      .notNull()
      .references(() => cart.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariant.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('cart_item_cart_idx').on(t.cartId)],
);

export const order = pgTable(
  'order',
  {
    id: id(),
    number: text('number').notNull().unique(), // e.g. PLT-000123
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending_payment'),
    subtotalCents: integer('subtotal_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    shippingAddress: jsonb('shipping_address').notNull(),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('order_user_idx').on(t.userId), index('order_placed_idx').on(t.placedAt)],
);

export const orderItem = pgTable(
  'order_item',
  {
    id: id(),
    orderId: text('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariant.id),
    productName: text('product_name').notNull(),
    variantLabel: text('variant_label').notNull(),
    sku: text('sku').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (t) => [index('order_item_order_idx').on(t.orderId)],
);

export const payment = pgTable('payment', {
  id: id(),
  orderId: text('order_id')
    .notNull()
    .references(() => order.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'requires_action', 'succeeded', 'failed'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  cardBrand: text('card_brand'),
  cardLast4: text('card_last4'),
  failureReason: text('failure_reason'),
  createdAt: createdAt(),
});

export const invoice = pgTable('invoice', {
  id: id(),
  number: text('number').notNull().unique(), // e.g. PLT-2026-0001
  orderId: text('order_id')
    .notNull()
    .unique()
    .references(() => order.id, { onDelete: 'cascade' }),
  totalCents: integer('total_cents').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refund = pgTable('refund', {
  id: id(),
  orderId: text('order_id')
    .notNull()
    .references(() => order.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  restock: boolean('restock').notNull().default(false),
  reason: text('reason'),
  actorId: text('actor_id'),
  createdAt: createdAt(),
});
