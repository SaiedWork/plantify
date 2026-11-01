"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { TrackedOrder } from "@plantify/contracts";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OrderItemRow } from "@/components/order-item-row";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderTotals } from "@/components/order-totals";
import { api, ApiError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error, reload } = useApi<TrackedOrder>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      await api(`/orders/${id}/cancel`, { method: "POST" });
      toast.success("Order cancelled");
      setConfirming(false);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel the order");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  if (error || !order) {
    return (
      <p>
        We couldn&apos;t find that order.{" "}
        <Link href="/account/orders" className="underline underline-offset-4">
          Back to orders
        </Link>
      </p>
    );
  }

  const a = order.shippingAddress;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden className="size-4" /> All orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{order.number}</h2>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDate(order.placedAt)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="items" className="rounded-xl border bg-card p-5">
          <h3 id="items" className="mb-1 font-semibold">
            Items
          </h3>
          <ul className="divide-y text-sm">
            {order.items.map((i) => (
              <OrderItemRow key={i.sku} item={i} />
            ))}
          </ul>
          <div className="mt-3 border-t pt-4">
            <OrderTotals totals={order} />
          </div>
        </section>

        <section aria-labelledby="progress" className="h-fit rounded-xl border bg-card p-5">
          <h3 id="progress" className="mb-4 font-semibold">
            Delivery status
          </h3>
          <OrderTimeline status={order.status} events={order.events} />
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h3 className="mb-2 font-semibold">Shipping to</h3>
          <p className="font-medium">{a.fullName}</p>
          <p className="text-muted-foreground">{a.line1}</p>
          {a.line2 && <p className="text-muted-foreground">{a.line2}</p>}
          <p className="text-muted-foreground">
            {a.city}
            {a.region ? `, ${a.region}` : ""} {a.postalCode}
          </p>
        </section>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <h3 className="mb-2 font-semibold">Payment</h3>
          {order.payment ? (
            <>
              <p className="capitalize">
                {order.payment.status}
                {order.payment.cardLast4 && ` · ${order.payment.cardBrand} ending ${order.payment.cardLast4}`}
              </p>
              {order.payment.failureReason && order.payment.status === "failed" && (
                <p className="text-muted-foreground">Reason: {order.payment.failureReason.replace(/_/g, " ")}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No payment attempt yet.</p>
          )}
          {order.invoice && (
            <p className="mt-2 text-muted-foreground">
              Invoice <strong className="font-medium text-foreground">{order.invoice.number}</strong>
            </p>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.invoice && (
          <Link href={`/account/orders/${order.id}/invoice`} className={cn(buttonVariants({ size: "lg" }))}>
            <FileText aria-hidden /> View invoice
          </Link>
        )}
        {order.status === "pending_payment" && (
          <Button variant="outline" size="lg" disabled={busy} onClick={() => setConfirming(true)}>
            Cancel order
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cancel this order?"
        description="Nothing has been charged. The order is cancelled and can't be paid afterwards."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        busy={busy}
        onConfirm={cancel}
      />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <OrderView />
    </Suspense>
  );
}
