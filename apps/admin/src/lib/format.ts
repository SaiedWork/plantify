const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatPrice = (cents: number) => usd.format(cents / 100);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "12.50" -> 1250. Returns null for anything that is not a sensible price. */
export function dollarsToCents(input: string): number | null {
  const n = Number(input.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export const centsToDollars = (cents: number) => (cents / 100).toFixed(2);
