"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { OrderDetail } from "@plantify/contracts";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderTotals } from "@/components/order-totals";
import { api, ApiError } from "@/lib/api-client";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const { data: order, loading, error, reload } = useApi<OrderDetail>(`/orders/${id}`);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!window.confirm("Cancel this order? Nothing has been charged.")) return;
    setBusy(true);
    try {
      await api(`/orders/${id}/cancel`, { method: "POST" });
      toast.success("Order cancelled");
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
        <Link href="/account/orders" className="underline">
          Back to orders
        </Link>
      </p>
    );
  }

  const a = order.shippingAddress;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/account/orders" className="text-sm text-muted-foreground hover:underline">
          ← All orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold">{order.number}</h2>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">Placed {formatDate(order.placedAt)}</p>
      </div>

      <div className="rounded-xl border p-4">
        <ul className="divide-y text-sm">
          {order.items.map((i) => (
            <li key={i.sku} className="flex justify-between py-2">
              <span>
                {i.productName} <span className="text-muted-foreground">({i.variantLabel}) × {i.quantity}</span>
              </span>
              <span>{formatPrice(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-3">
          <OrderTotals totals={order} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border p-4 text-sm">
          <h3 className="mb-1 font-semibold">Shipping to</h3>
          <p>{a.fullName}</p>
          <p>{a.line1}</p>
          {a.line2 && <p>{a.line2}</p>}
          <p>
            {a.city}
            {a.region ? `, ${a.region}` : ""} {a.postalCode}
          </p>
        </section>
        <section className="rounded-xl border p-4 text-sm">
          <h3 className="mb-1 font-semibold">Payment</h3>
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
            <p className="mt-2">
              Invoice <strong>{order.invoice.number}</strong>
            </p>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.invoice && (
          <Link href={`/account/orders/${order.id}/invoice`} className={cn(buttonVariants())}>
            View invoice
          </Link>
        )}
        {order.status === "pending_payment" && (
          <Button variant="outline" disabled={busy} onClick={cancel}>
            Cancel order
          </Button>
        )}
      </div>
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
