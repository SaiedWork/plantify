import { z } from 'zod';
import { pagingSchema } from './admin.js';
import type { OrderStatus } from './orders.js';
import type { Role } from './roles.js';

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export const dashboardQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((n): n is (typeof DASHBOARD_RANGES)[number] => (DASHBOARD_RANGES as readonly number[]).includes(n), {
      message: 'days must be 7, 30 or 90',
    })
    .default(30),
});

/** Counts only, no money: each section is present only when the caller's role may see it. */
export type AdminOverview = {
  days: number;
  catalog?: {
    products: number;
    active: number;
    draft: number;
    archived: number;
    categories: number;
    variants: number;
    lowStock: number;
    outOfStock: number;
    /** Units sold per day over the range, zero-filled (`date` is YYYY-MM-DD, UTC). */
    series: { date: string; units: number }[];
    productsByCategory: { name: string; products: number }[];
    bestSellers: { name: string; units: number }[];
  };
  orders?: {
    awaitingPayment: number;
    toProcess: number;
    processing: number;
    shipped: number;
    placedToday: number;
    /** Orders placed per day over the range, zero-filled. */
    series: { date: string; orders: number }[];
    byStatus: { status: OrderStatus; count: number }[];
  };
  customers?: number;
};

export type KpiPair = { current: number; previous: number };

export type DashboardStats = {
  days: number;
  /** Net sales: paid, processing, shipped and delivered orders. Refunds are reported separately. */
  kpis: {
    revenueCents: KpiPair;
    orders: KpiPair;
    averageOrderCents: KpiPair;
    newCustomers: KpiPair;
    refundedCents: KpiPair;
  };
  /** One entry per day in the range, zero-filled. `date` is YYYY-MM-DD (UTC). */
  series: { date: string; revenueCents: number; orders: number }[];
  topProducts: { productId: string; name: string; units: number; revenueCents: number }[];
  ordersByStatus: { status: OrderStatus; count: number }[];
  categoryRevenue: { name: string; revenueCents: number }[];
};

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.refunded',
  'inventory.low',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_SIGNATURE_HEADER = 'x-plantify-signature';

/**
 * The built-in demo receiver. Not a real URL: the dispatcher recognises it and verifies the signed
 * delivery in-process, so a fresh install has a working endpoint without any network access.
 */
export const WEBHOOK_ECHO_URL = 'plantify://echo';
export const WEBHOOK_ECHO_LABEL = 'Plantify Echo (built-in)';

export const webhookEndpointSchema = z.object({
  url: z.string().trim().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
  active: z.boolean().default(true),
});
export const webhookEndpointPatchSchema = webhookEndpointSchema.partial();
export type WebhookEndpointInput = z.infer<typeof webhookEndpointSchema>;

export type WebhookEndpointView = {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
  stats: { delivered: number; failed: number; pending: number };
};

export const deliveryQuerySchema = pagingSchema.extend({
  endpointId: z.string().max(64).optional(),
  status: z.enum(['pending', 'delivered', 'failed']).optional(),
});
export type DeliveryQuery = z.infer<typeof deliveryQuerySchema>;

export type WebhookDeliveryView = {
  id: string;
  endpointId: string;
  endpointUrl: string;
  event: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  responseCode: number | null;
  lastError: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
  payload: unknown;
};

export type WebhookEnvelope<T = unknown> = {
  id: string;
  type: WebhookEventType | 'ping';
  createdAt: string;
  data: T;
};

/** The owner is fixed; only these two roles can be switched between. */
export const STAFF_SWITCHABLE_ROLES = ['catalog_manager', 'order_manager'] as const;
export const staffRolePatchSchema = z.object({ role: z.enum(STAFF_SWITCHABLE_ROLES) });

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, 'customer'>;
  createdAt: string;
};

export const auditQuerySchema = pagingSchema.extend({
  action: z.string().trim().max(60).optional(),
  actorId: z.string().max(64).optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export type AuditEntry = {
  id: string;
  action: string;
  target: string | null;
  detail: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
};

