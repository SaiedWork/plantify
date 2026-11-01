const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatPrice = (cents: number) => usd.format(cents / 100);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
