import type { Totals } from "@plantify/contracts";
import { formatPrice } from "@/lib/format";

export function OrderTotals({ totals }: { totals: Totals }) {
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd>{formatPrice(totals.subtotalCents)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Shipping</dt>
        <dd>{totals.shippingCents === 0 ? "Free" : formatPrice(totals.shippingCents)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Tax (8%)</dt>
        <dd>{formatPrice(totals.taxCents)}</dd>
      </div>
      <div className="flex justify-between border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd>{formatPrice(totals.totalCents)}</dd>
      </div>
    </dl>
  );
}
