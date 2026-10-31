import { describe, expect, it } from 'vitest';
import { canTransition, computeTotals, evaluateDemoCard, productListQuerySchema, can, isResetDue, demoStatus, type CardInput } from './index.js';

const card = (number: string, over: Partial<CardInput> = {}): CardInput => ({
  number,
  expMonth: 12,
  expYear: 2030,
  cvc: '123',
  name: 'Demo',
  ...over,
});
const NOW = new Date('2026-10-28T00:00:00Z');

describe('computeTotals', () => {
  it('adds flat shipping and 8% tax under $50', () => {
    expect(computeTotals(2000)).toEqual({ subtotalCents: 2000, shippingCents: 799, taxCents: 160, totalCents: 2959 });
  });
  it('ships free from $50', () => {
    expect(computeTotals(5000).shippingCents).toBe(0);
    expect(computeTotals(4999).shippingCents).toBe(799);
  });
  it('charges nothing for an empty cart', () => {
    expect(computeTotals(0).totalCents).toBe(0);
  });
});

describe('evaluateDemoCard', () => {
  it('accepts the simple demo number with spaces', () => {
    expect(evaluateDemoCard(card('1234 5678 9'), NOW)).toMatchObject({ ok: true, outcome: 'success', last4: '6789' });
  });
  it('declines the declined card', () => {
    expect(evaluateDemoCard(card('0000 0000 0'), NOW)).toMatchObject({ ok: true, outcome: 'declined', failureReason: 'card_declined' });
  });
  it('asks for 3-D Secure on the third card', () => {
    expect(evaluateDemoCard(card('111111111'), NOW)).toMatchObject({ ok: true, outcome: 'requires_action' });
  });
  it('rejects numbers that are not demo cards', () => {
    expect(evaluateDemoCard(card('5555555555554444'), NOW)).toMatchObject({ ok: false });
  });
  it('rejects expired cards and wrong CVCs', () => {
    expect(evaluateDemoCard(card('123456789', { expYear: 2026, expMonth: 9 }), NOW)).toMatchObject({ ok: false });
    expect(evaluateDemoCard(card('123456789', { expYear: 2026, expMonth: 10 }), NOW)).toMatchObject({ ok: true });
    expect(evaluateDemoCard(card('123456789', { cvc: '000' }), NOW)).toMatchObject({ ok: false });
  });
});

describe('order status machine', () => {
  it('allows the happy path and forbids skipping or reviving', () => {
    expect(canTransition('pending_payment', 'paid')).toBe(true);
    expect(canTransition('paid', 'processing')).toBe(true);
    expect(canTransition('processing', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
    expect(canTransition('paid', 'delivered')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('refunded', 'paid')).toBe(false);
  });
});

describe('permissions', () => {
  it('keeps billing and refunds owner-only', () => {
    expect(can('owner', 'billing:manage')).toBe(true);
    expect(can('catalog_manager', 'billing:manage')).toBe(false);
    expect(can('catalog_manager', 'orders:refund')).toBe(false);
    expect(can('catalog_manager', 'inventory:manage')).toBe(true);
    expect(can('customer', 'orders:view')).toBe(false);
  });
});

describe('productListQuerySchema', () => {
  it('applies defaults and coerces numbers', () => {
    expect(productListQuerySchema.parse({ page: '2', minPrice: '1500' })).toMatchObject({ page: 2, minPrice: 1500, sort: 'relevance', pageSize: 12 });
  });
  it('rejects unknown sorts and oversized pages', () => {
    expect(productListQuerySchema.safeParse({ sort: 'drop' }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('demo reset schedule', () => {
  const day = 24 * 60 * 60 * 1000;
  const last = new Date('2026-01-01T00:00:00Z');

  it('is due when never reset or at least 7 days old', () => {
    expect(isResetDue(null)).toBe(true);
    expect(isResetDue(last, new Date(last.getTime() + 7 * day))).toBe(true);
    expect(isResetDue(last, new Date(last.getTime() + 7 * day - 1))).toBe(false);
  });

  it('counts whole days remaining, rounded up', () => {
    expect(demoStatus(last, last).daysUntilReset).toBe(7);
    expect(demoStatus(last, new Date(last.getTime() + 6.5 * day)).daysUntilReset).toBe(1);
    expect(demoStatus(last, new Date(last.getTime() + 9 * day)).daysUntilReset).toBe(0);
    expect(demoStatus(null).daysUntilReset).toBeNull();
  });
});
