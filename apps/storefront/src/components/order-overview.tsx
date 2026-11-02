import Link from "next/link";
import type { ReactNode } from "react";
import type { TrackedOrder } from "@plantify/contracts";
import { FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OrderItemRow } from "@/components/order-item-row";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderTotals } from "@/components/order-totals";
import { cn } from "@/lib/utils";

/**
 * The body of an order page, shared by the guest tracking page and the account order page: shipping and payment
 * with the invoice button on the left, delivery status below it, and the items on the right. It lays out by the
 * width of its container, so it also fits the narrower account column.
 */
export function OrderOverview({ order, invoiceHref, actions }: { order: TrackedOrder; invoiceHref: string; actions?: ReactNode }) {
  const a = order.shippingAddress;
  return (
    <div className="@container">
      <div className="grid gap-6 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <section aria-labelledby="ship" className="space-y-4 rounded-xl border bg-card p-6 text-sm">
            <h2 id="ship" className="font-semibold">
              Shipping to
            </h2>
            <div className="space-y-4">
              <p className="font-medium">{a.fullName}</p>
              <p className="leading-relaxed text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}
                {a.region ? `, ${a.region}` : ""} {a.postalCode}
              </p>
              {order.payment?.cardLast4 && order.payment.status !== "failed" && (
                <p className="text-muted-foreground">
                  Paid with {order.payment.cardBrand} ending {order.payment.cardLast4} (simulated)
                </p>
              )}
              {order.payment?.status === "failed" && order.payment.failureReason && (
                <p className="text-muted-foreground">Payment failed: {order.payment.failureReason.replace(/_/g, " ")}</p>
              )}
            </div>
            {order.invoice && (
              <Link href={invoiceHref} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                <FileText aria-hidden /> View invoice
              </Link>
            )}
            {actions}
          </section>

          <section aria-labelledby="progress" className="rounded-xl border bg-card p-6">
            <h2 id="progress" className="mb-5 font-semibold">
              Delivery status
            </h2>
            <OrderTimeline status={order.status} events={order.events} />
          </section>
        </div>

        {/* When wide, the items card is as tall as the left column (it does not add to the row's height), so a long
            order scrolls inside the card while the totals stay at its foot. */}
        <section aria-labelledby="items" className="relative">
          <div className="flex max-h-[32rem] flex-col rounded-xl border bg-card @2xl:absolute @2xl:inset-0 @2xl:max-h-none">
            <h2 id="items" className="p-6 pb-3 font-semibold">
              Items
            </h2>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto px-6 text-sm">
              {order.items.map((i) => (
                <OrderItemRow key={i.sku} item={i} />
              ))}
            </ul>
            <div className="border-t p-6">
              <OrderTotals totals={order} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
