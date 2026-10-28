import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id } from './_helpers.js';

export const demoEmail = pgTable(
  'demo_email',
  {
    id: id(),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    otp: text('otp'),
    createdAt: createdAt(),
  },
  (t) => [index('demo_email_to_idx').on(t.to, t.createdAt)],
);

export const webhookEndpoint = pgTable('webhook_endpoint', {
  id: id(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: jsonb('events').$type<string[]>().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});

export const webhookDelivery = pgTable('webhook_delivery', {
  id: id(),
  endpointId: text('endpoint_id')
    .notNull()
    .references(() => webhookEndpoint.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['pending', 'delivered', 'failed'] })
    .notNull()
    .default('pending'),
  attempts: integer('attempts').notNull().default(0),
  responseCode: integer('response_code'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  createdAt: createdAt(),
});

// Inbound webhook idempotency and delivery log.
export const webhookEventInbox = pgTable('webhook_event_inbox', {
  eventId: text('event_id').primaryKey(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  receivedAt: createdAt(),
});

export const auditLog = pgTable('audit_log', {
  id: id(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  target: text('target'),
  detail: jsonb('detail'),
  createdAt: createdAt(),
});

export const rateLimit = pgTable('rate_limit', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});

export const meta = pgTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
