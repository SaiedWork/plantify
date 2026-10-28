import { z } from 'zod';
import { MAX_QTY_PER_LINE, type Totals } from './pricing.js';

export const addCartItemSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE).default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(MAX_QTY_PER_LINE),
});

export type CartLine = {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  stock: number;
  lineTotalCents: number;
};

export type CartView = Totals & {
  lines: CartLine[];
  itemCount: number;
};
