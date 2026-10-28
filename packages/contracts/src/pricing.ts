export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;
export const FLAT_SHIPPING_CENTS = 799;
export const TAX_RATE = 0.08;
export const MAX_QTY_PER_LINE = 10;
export const MAX_CART_LINES = 20;

export type Totals = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/** Single source of truth for cart, checkout and invoices. */
export function computeTotals(subtotalCents: number): Totals {
  const shippingCents = subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  return { subtotalCents, shippingCents, taxCents, totalCents: subtotalCents + shippingCents + taxCents };
}
