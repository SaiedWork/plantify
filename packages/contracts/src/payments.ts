import { z } from 'zod';

/**
 * Demo-only card rules. No real payment network is involved and nothing but brand + last4 is stored.
 * Card numbers are compared with spaces/dashes removed.
 */
export const DEMO_CARDS = {
  success: ['123456789', '4242424242424242'],
  declined: ['000000000', '4000000000000002'],
  requiresAction: ['111111111', '4000002500003155'],
} as const;

export const DEMO_CVC = '123';

export const cardSchema = z.object({
  number: z.string().trim().min(1).max(30),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2000).max(2100),
  cvc: z.string().trim().regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits'),
  name: z.string().trim().min(1).max(80),
});
export type CardInput = z.infer<typeof cardSchema>;

export type CardOutcome = 'success' | 'declined' | 'requires_action';

export type CardEvaluation =
  | { ok: true; outcome: CardOutcome; brand: string; last4: string; failureReason?: string }
  | { ok: false; error: string };

const digitsOf = (n: string) => n.replace(/[\s-]/g, '');

function brandOf(digits: string) {
  if (digits.startsWith('4')) return 'visa';
  if (digits.startsWith('5')) return 'mastercard';
  if (digits.startsWith('3')) return 'amex';
  return 'demo';
}

export function evaluateDemoCard(card: CardInput, now = new Date()): CardEvaluation {
  const digits = digitsOf(card.number);
  const known = [...DEMO_CARDS.success, ...DEMO_CARDS.declined, ...DEMO_CARDS.requiresAction] as readonly string[];
  if (!known.includes(digits)) {
    return { ok: false, error: 'This is a demo store. Please use one of the demo cards shown on the page.' };
  }

  const expired = card.expYear < now.getFullYear() || (card.expYear === now.getFullYear() && card.expMonth < now.getMonth() + 1);
  if (expired) return { ok: false, error: 'This card has expired.' };
  if (card.cvc !== DEMO_CVC) return { ok: false, error: 'Wrong CVC. The demo CVC is 123.' };

  const base = { ok: true as const, brand: brandOf(digits), last4: digits.slice(-4) };
  if ((DEMO_CARDS.declined as readonly string[]).includes(digits)) {
    return { ...base, outcome: 'declined', failureReason: 'card_declined' };
  }
  if ((DEMO_CARDS.requiresAction as readonly string[]).includes(digits)) {
    return { ...base, outcome: 'requires_action' };
  }
  return { ...base, outcome: 'success' };
}

/** Event shape posted to /api/webhooks/payments. */
export type PaymentEvent = {
  id: string;
  type: 'payment.succeeded' | 'payment.failed';
  createdAt: string;
  data: { paymentId: string; orderId: string; failureReason?: string };
};

export const SIGNATURE_HEADER = 'x-plantify-signature';
export const SIGNATURE_TOLERANCE_SECONDS = 300;
