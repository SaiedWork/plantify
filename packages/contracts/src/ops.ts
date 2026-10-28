import { z } from 'zod';
import { pagingSchema } from './admin.js';
import type { OrderStatus } from './orders.js';
import type { Role } from './roles.js';

// ---- dashboard ---------------------------------------------------------------------------------

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

// ---- outbound webhooks -------------------------------------------------------------------------

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

// ---- staff & audit -----------------------------------------------------------------------------

export const STAFF_GRANTABLE_ROLES = ['catalog_manager', 'owner'] as const;
export const grantStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(STAFF_GRANTABLE_ROLES),
});
export const staffRolePatchSchema = z.object({ role: z.enum(STAFF_GRANTABLE_ROLES) });

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: Extract<Role, 'owner' | 'catalog_manager'>;
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

