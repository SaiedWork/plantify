import { z } from 'zod';
import { cardSchema } from './payments.js';

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed status moves; the API refuses anything else. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => ORDER_TRANSITIONS[from].includes(to);

export const addressSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).default('US'),
});
export type Address = z.infer<typeof addressSchema>;

export const MAX_SAVED_ADDRESSES = 10;

export const savedAddressSchema = addressSchema.extend({ isDefault: z.boolean().optional() });
export const savedAddressPatchSchema = savedAddressSchema.partial();
export type SavedAddressInput = z.infer<typeof savedAddressSchema>;

export type AddressView = Omit<Address, 'line2' | 'region'> & {
  id: string;
  line2: string | null;
  region: string | null;
  isDefault: boolean;
};

export const createOrderSchema = z.object({ shippingAddress: addressSchema });
export const payOrderSchema = z.object({ card: cardSchema });

export type OrderItemView = {
  productName: string;
  variantLabel: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
};

export type OrderSummary = {
  id: string;
  number: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  placedAt: string;
};

export type OrderDetail = OrderSummary & {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  currency: string;
  shippingAddress: Address;
  items: OrderItemView[];
  payment: { status: string; cardBrand: string | null; cardLast4: string | null; failureReason: string | null } | null;
  invoice: { number: string; issuedAt: string } | null;
};

export type PayResult =
  | { status: 'paid'; orderId: string }
  | { status: 'failed'; orderId: string; reason: string }
  | { status: 'requires_action'; orderId: string; paymentId: string };
