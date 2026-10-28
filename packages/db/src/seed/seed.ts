import { faker } from '@faker-js/faker';
import { hashPassword } from 'better-auth/crypto';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../client.js';
import * as s from '../schema/index.js';
import { CATEGORIES, PLANT_VARIANTS, PRODUCTS, slugify } from './catalog-data.js';

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;
const CUSTOMER_COUNT = 60;

/** Public on purpose: shown on the admin login page's "demo login" buttons. */
export const DEMO_STAFF_PASSWORD = 'plantify-demo';

export const STAFF = [
  { name: 'Olivia Owner', email: 'owner@plantify.test', role: 'owner' as const },
  { name: 'Carlos Catalog', email: 'catalog@plantify.test', role: 'catalog_manager' as const },
];

type OrderStatus = (typeof s.ORDER_STATUSES)[number];

async function insertChunks(db: Db, table: PgTable, rows: object[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size) as never);
  }
}

function statusForAge(ageDays: number): OrderStatus {
  const roll = faker.number.float({ min: 0, max: 1 });
  if (ageDays < 0.5) return roll < 0.15 ? 'pending_payment' : 'paid';
  if (ageDays < 3) return roll < 0.5 ? 'paid' : roll < 0.9 ? 'processing' : 'cancelled';
  if (ageDays < 10) return roll < 0.5 ? 'shipped' : roll < 0.85 ? 'delivered' : roll < 0.92 ? 'processing' : 'cancelled';
  return roll < 0.88 ? 'delivered' : roll < 0.95 ? 'refunded' : 'cancelled';
}

/** Populates an already-migrated, empty database with deterministic fake data. */
export async function seed(db: Db, now = new Date()) {
  faker.seed(42);

  // --- Catalog -----------------------------------------------------------
  const categories = CATEGORIES.map((c, i) => ({ id: crypto.randomUUID(), sortOrder: i, ...c }));
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));
  await insertChunks(db, s.category, categories);

  const products: (typeof s.product.$inferInsert)[] = [];
  const variants: (typeof s.productVariant.$inferInsert & { id: string; productName: string })[] = [];
  const images: (typeof s.productImage.$inferInsert)[] = [];

  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    const productId = crypto.randomUUID();
    products.push({
      id: productId,
      slug,
      name: p.name,
      description: p.blurb,
      categoryId: categoryId.get(p.category)!,
      featured: p.featured ?? false,
      status: 'active',
      createdAt: new Date(now.getTime() - HISTORY_DAYS * DAY),
    });
    images.push({ productId, url: `/products/${slug}.svg`, alt: p.name, position: 0 });

    const skuBase = slug.replace(/-/g, '').slice(0, 6).toUpperCase();
    if (p.kind === 'plant') {
      for (const v of PLANT_VARIANTS) {
        variants.push({
          id: crypto.randomUUID(),
          productId,
          productName: p.name,
          sku: `${skuBase}-${v.suffix}`,
          label: v.label,
          priceCents: Math.round((p.baseCents * v.multiplier) / 50) * 50,
        });
      }
    } else {
      variants.push({
        id: crypto.randomUUID(),
        productId,
        productName: p.name,
        sku: `${skuBase}-STD`,
        label: 'Standard',
        priceCents: p.baseCents,
      });
    }
  }
  await insertChunks(db, s.product, products);
  await insertChunks(db, s.productImage, images);
  await insertChunks(
    db,
    s.productVariant,
    variants.map(({ productName: _n, ...v }) => v),
  );

  // --- Users -------------------------------------------------------------
  // Credentials (password accounts) are created in milestone 2 through Better Auth's hasher.
  const staffRows = STAFF.map((u) => ({
    id: crypto.randomUUID(),
    ...u,
    emailVerified: true,
    createdAt: new Date(now.getTime() - HISTORY_DAYS * DAY),
  }));

  const customers = Array.from({ length: CUSTOMER_COUNT }, (_, i) => {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    return {
      id: crypto.randomUUID(),
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, ''),
      emailVerified: true,
      role: 'customer' as const,
      // Signups spread over the history window, weighted toward earlier days.
      createdAt: new Date(now.getTime() - faker.number.int({ min: 1, max: HISTORY_DAYS }) * DAY),
      address: {
        fullName: `${first} ${last}`,
        line1: faker.location.streetAddress(),
        city: faker.location.city(),
        region: faker.location.state({ abbreviated: true }),
        postalCode: faker.location.zipCode('#####'),
        country: 'US',
      },
    };
  });
  await insertChunks(db, s.user, staffRows);
  const passwordHash = await hashPassword(DEMO_STAFF_PASSWORD);
  await insertChunks(
    db,
    s.account,
    staffRows.map((u) => ({ id: crypto.randomUUID(), userId: u.id, accountId: u.id, providerId: 'credential', password: passwordHash })),
  );
  await insertChunks(
    db,
    s.user,
    customers.map(({ address: _a, ...u }) => u),
  );
  await insertChunks(
    db,
    s.address,
    customers.map((c) => ({ userId: c.id, isDefault: true, ...c.address })),
  );

  // --- Orders ------------------------------------------------------------
  type PlannedOrder = {
    id: string;
    userId: string;
    placedAt: Date;
    status: OrderStatus;
    lines: { variant: (typeof variants)[number]; quantity: number }[];
    address: (typeof customers)[number]['address'];
  };
  const planned: PlannedOrder[] = [];

  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const weekday = new Date(now.getTime() - d * DAY).getDay();
    const growth = 1 + ((HISTORY_DAYS - d) / HISTORY_DAYS) * 1.5;
    const weekend = weekday === 0 || weekday === 6 ? 1.4 : 1;
    const count = Math.max(0, Math.round(2.2 * growth * weekend + faker.number.float({ min: -1.5, max: 1.5 })));
    for (let n = 0; n < count; n++) {
      const placedAt = new Date(now.getTime() - d * DAY + faker.number.int({ min: 0, max: DAY - 1 }));
      if (placedAt > now) continue;
      const customer = faker.helpers.arrayElement(customers);
      // A customer cannot order before they signed up.
      if (placedAt < customer.createdAt) continue;
      const lineCount = faker.helpers.weightedArrayElement([
        { weight: 5, value: 1 },
        { weight: 3, value: 2 },
        { weight: 1.5, value: 3 },
        { weight: 0.5, value: 4 },
      ]);
      const picked = faker.helpers.arrayElements(variants, lineCount);
      planned.push({
        id: crypto.randomUUID(),
        userId: customer.id,
        placedAt,
        status: statusForAge((now.getTime() - placedAt.getTime()) / DAY),
        lines: picked.map((variant) => ({
          variant,
          quantity: faker.helpers.weightedArrayElement([
            { weight: 6, value: 1 },
            { weight: 3, value: 2 },
            { weight: 1, value: 3 },
          ]),
        })),
        address: customer.address,
      });
    }
  }
  planned.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

  const orders: (typeof s.order.$inferInsert)[] = [];
  const orderItems: (typeof s.orderItem.$inferInsert)[] = [];
  const payments: (typeof s.payment.$inferInsert)[] = [];
  const invoices: (typeof s.invoice.$inferInsert)[] = [];
  const refunds: (typeof s.refund.$inferInsert)[] = [];
  const movements: (typeof s.inventoryMovement.$inferInsert)[] = [];
  const delta = new Map<string, number>(); // variantId -> net change from orders
  const invoiceSeq = new Map<number, number>();

  planned.forEach((o, i) => {
    const subtotal = o.lines.reduce((sum, l) => sum + l.variant.priceCents! * l.quantity, 0);
    const shipping = subtotal >= 5000 ? 0 : 799;
    const tax = Math.round(subtotal * 0.08);
    const total = subtotal + shipping + tax;
    const number = `PLT-${String(i + 1).padStart(6, '0')}`;

    orders.push({
      id: o.id,
      number,
      userId: o.userId,
      status: o.status,
      subtotalCents: subtotal,
      shippingCents: shipping,
      taxCents: tax,
      totalCents: total,
      shippingAddress: o.address,
      placedAt: o.placedAt,
      createdAt: o.placedAt,
      updatedAt: o.placedAt,
    });

    for (const l of o.lines) {
      orderItems.push({
        orderId: o.id,
        variantId: l.variant.id!,
        productName: l.variant.productName,
        variantLabel: l.variant.label!,
        sku: l.variant.sku!,
        unitPriceCents: l.variant.priceCents!,
        quantity: l.quantity,
      });
    }

    const paid = o.status !== 'pending_payment' && o.status !== 'cancelled';
    payments.push({
      orderId: o.id,
      status: paid ? 'succeeded' : o.status === 'cancelled' ? 'failed' : 'pending',
      amountCents: total,
      cardBrand: paid || o.status === 'cancelled' ? faker.helpers.arrayElement(['visa', 'mastercard', 'amex']) : null,
      cardLast4: paid || o.status === 'cancelled' ? faker.string.numeric(4) : null,
      failureReason: o.status === 'cancelled' ? 'card_declined' : null,
      createdAt: o.placedAt,
    });

    if (!paid) return;

    const year = o.placedAt.getFullYear();
    const seq = (invoiceSeq.get(year) ?? 0) + 1;
    invoiceSeq.set(year, seq);
    invoices.push({
      number: `PLT-${year}-${String(seq).padStart(4, '0')}`,
      orderId: o.id,
      totalCents: total,
      issuedAt: o.placedAt,
    });

    for (const l of o.lines) {
      delta.set(l.variant.id!, (delta.get(l.variant.id!) ?? 0) - l.quantity);
      movements.push({
        variantId: l.variant.id!,
        delta: -l.quantity,
        reason: 'sale',
        orderId: o.id,
        createdAt: o.placedAt,
      });
    }

    if (o.status === 'refunded') {
      const restock = faker.datatype.boolean();
      refunds.push({
        orderId: o.id,
        amountCents: total,
        restock,
        reason: faker.helpers.arrayElement(['Arrived damaged', 'Changed my mind', 'Wrong plant ordered']),
        actorId: staffRows[0]!.id,
        createdAt: new Date(o.placedAt.getTime() + 2 * DAY),
      });
      if (restock) {
        for (const l of o.lines) {
          delta.set(l.variant.id!, (delta.get(l.variant.id!) ?? 0) + l.quantity);
          movements.push({
            variantId: l.variant.id!,
            delta: l.quantity,
            reason: 'return',
            orderId: o.id,
            createdAt: new Date(o.placedAt.getTime() + 2 * DAY),
          });
        }
      }
    }
  });

  // Opening stock = what was consumed + the stock left today, so on-hand is never negative.
  const levels = variants.map((v) => {
    const consumed = -(delta.get(v.id) ?? 0);
    const lowStock = faker.number.float({ min: 0, max: 1 }) < 0.12;
    const remaining = lowStock ? faker.number.int({ min: 0, max: 4 }) : faker.number.int({ min: 12, max: 80 });
    movements.push({
      variantId: v.id,
      delta: consumed + remaining,
      reason: 'restock',
      note: 'Opening stock',
      createdAt: new Date(now.getTime() - (HISTORY_DAYS + 10) * DAY),
    });
    return { variantId: v.id, onHand: remaining };
  });

  await insertChunks(db, s.order, orders);
  await insertChunks(db, s.orderItem, orderItems);
  await insertChunks(db, s.payment, payments);
  await insertChunks(db, s.invoice, invoices);
  await insertChunks(db, s.refund, refunds);
  await insertChunks(db, s.inventoryLevel, levels);
  await insertChunks(db, s.inventoryMovement, movements);

  await insertChunks(db, s.meta, [
    { key: 'last_reset_at', value: now.toISOString() },
    { key: 'seed_version', value: '1' },
  ]);

  return {
    categories: categories.length,
    products: products.length,
    variants: variants.length,
    customers: customers.length,
    orders: orders.length,
    invoices: invoices.length,
  };
}
