import { z } from 'zod';
import { ORDER_STATUSES, type Address, type OrderItemView, type OrderStatus } from './orders.js';

// ---- shared bits -------------------------------------------------------------------------------

export const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

const boolParam = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/** Image URLs we accept: bundled `/products/*`, our own uploads, or https links. */
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => u.startsWith('/products/') || u.startsWith('/api/uploads/') || /^https:\/\/[^\s]+$/.test(u), {
    message: 'Image must be a bundled image, an upload, or an https URL',
  });

// ---- products ----------------------------------------------------------------------------------

export const MAX_IMAGES_PER_PRODUCT = 4;

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const adminProductQuerySchema = pagingSchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
});
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;

const variantFields = {
  label: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(50).max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
};

export const newVariantSchema = z.object({
  ...variantFields,
  sku: z.string().trim().regex(/^[A-Za-z0-9-]{3,30}$/, 'SKU: 3-30 letters, digits or dashes').optional(),
  initialStock: z.number().int().min(0).max(10_000).default(0),
});
export type NewVariantInput = z.infer<typeof newVariantSchema>;

export const variantPatchSchema = z
  .object({
    label: variantFields.label,
    priceCents: variantFields.priceCents,
    lowStockThreshold: z.number().int().min(0).max(1000),
    sku: z.string().trim().regex(/^[A-Za-z0-9-]{3,30}$/, 'SKU: 3-30 letters, digits or dashes'),
  })
  .partial();

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  categoryId: z.string().min(1).max(64),
  status: z.enum(PRODUCT_STATUSES).default('draft'),
  featured: z.boolean().default(false),
  variants: z.array(newVariantSchema).min(1).max(10),
  /** Optional images, the first one is the cover. */
  images: z.array(z.object({ url: imageUrl, alt: z.string().trim().max(160).default('') })).max(MAX_IMAGES_PER_PRODUCT).default([]),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const productPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000),
    categoryId: z.string().min(1).max(64),
    status: z.enum(PRODUCT_STATUSES),
    featured: z.boolean(),
  })
  .partial();

export const addImageSchema = z.object({ url: imageUrl, alt: z.string().trim().max(160).default('') });

export type AdminProductListItem = {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  featured: boolean;
  category: { id: string; name: string };
  imageUrl: string | null;
  variantCount: number;
  stock: number;
  minPriceCents: number;
  updatedAt: string;
};

export type AdminVariant = {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  lowStockThreshold: number;
  stock: number;
};

export type AdminProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  status: ProductStatus;
  featured: boolean;
  images: { id: string; url: string; alt: string; position: number }[];
  variants: AdminVariant[];
};

// ---- categories --------------------------------------------------------------------------------

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export const categoryPatchSchema = categoryInputSchema.partial();

export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  productCount: number;
};

// ---- inventory ---------------------------------------------------------------------------------

export const inventoryQuerySchema = pagingSchema.extend({
  q: z.string().trim().max(80).optional(),
  lowStock: boolParam,
});
export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;

export const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .min(-1000)
    .max(1000)
    .refine((n) => n !== 0, { message: 'Change cannot be zero' }),
  reason: z.enum(['restock', 'adjustment']),
  note: z.string().trim().max(200).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export type InventoryRow = {
  variantId: string;
  productId: string;
  productName: string;
  label: string;
  sku: string;
  onHand: number;
  lowStockThreshold: number;
  isLow: boolean;
};

export type StockMovement = {
  id: string;
  delta: number;
  reason: 'sale' | 'restock' | 'adjustment' | 'return';
  note: string | null;
  orderId: string | null;
  actorName: string | null;
  createdAt: string;
};

// ---- orders ------------------------------------------------------------------------------------

export const adminOrderQuerySchema = pagingSchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
});
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

/** Statuses fulfilment staff may move an order to (cancel is only for never-paid orders). */
export const FULFILMENT_TARGETS = ['processing', 'shipped', 'delivered', 'cancelled'] as const;
export const orderStatusChangeSchema = z.object({ status: z.enum(FULFILMENT_TARGETS) });

export const refundSchema = z.object({
  restock: z.boolean().default(true),
  reason: z.string().trim().max(200).optional(),
});

export type AdminOrderListItem = {
  id: string;
  number: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  placedAt: string;
  /** `id` is null for guest orders, which have no account. */
  customer: { id: string | null; name: string; email: string; guest: boolean };
};

export type AdminOrderDetail = AdminOrderListItem & {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  currency: string;
  shippingAddress: Address;
  items: (OrderItemView & { imageUrl: string | null })[];
  payments: { id: string; status: string; cardBrand: string | null; cardLast4: string | null; failureReason: string | null; createdAt: string }[];
  invoice: { number: string; issuedAt: string } | null;
  refunds: { id: string; amountCents: number; restock: boolean; reason: string | null; createdAt: string }[];
};

// ---- customers ---------------------------------------------------------------------------------

export const customerQuerySchema = pagingSchema.extend({ q: z.string().trim().max(80).optional() });
export type CustomerQuery = z.infer<typeof customerQuerySchema>;

export type CustomerListItem = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  orderCount: number;
  lifetimeCents: number;
};

export type CustomerDetail = CustomerListItem & {
  orders: { id: string; number: string; status: OrderStatus; totalCents: number; placedAt: string }[];
};
