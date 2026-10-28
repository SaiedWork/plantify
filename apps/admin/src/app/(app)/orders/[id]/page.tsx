"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { AdminOrderDetail } from "@plantify/contracts";
import { canTransition } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMe } from "@/components/admin-shell";
import { Badge, OrderBadge, PageHeader, RequirePermission, Skeleton } from "@/components/page-bits";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

const NEXT_STEP = { paid: "processing", processing: "shipped", shipped: "delivered" } as const;
const NEXT_LABEL = { processing: "Start processing", shipped: "Mark as shipped", delivered: "Mark as delivered" } as const;

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const { can } = useMe();
  const { data: order, loading, error, reload } = useApi<AdminOrderDetail>(`/admin/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("");

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-96" />;
  if (error || !order) {
    return (
      <p>
        {error ?? "Order not found."}{" "}
        <Link href="/orders" className="underline">
          Back to orders
        </Link>
      </p>
    );
  }

  const next = order.status in NEXT_STEP ? NEXT_STEP[order.status as keyof typeof NEXT_STEP] : null;
  const a = order.shippingAddress;
  const refundable = canTransition(order.status, "refunded");

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={order.number}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        actions={
          <>
            <OrderBadge status={order.status} />
            <Link href="/orders" className="inline-flex h-8 items-center px-3 text-sm underline">
              All orders
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {next && can("orders:fulfil") && (
          <Button disabled={busy} onClick={() => act(() => api(`/admin/orders/${id}/status`, { method: "POST", json: { status: next } }), "Order updated")}>
            {NEXT_LABEL[next]}
          </Button>
        )}
        {order.status === "pending_payment" && can("orders:fulfil") && (
          <Button variant="outline" disabled={busy} onClick={() => window.confirm("Cancel this unpaid order?") && void act(() => api(`/admin/orders/${id}/status`, { method: "POST", json: { status: "cancelled" } }), "Order cancelled")}>
            Cancel order
          </Button>
        )}
        {!can("orders:fulfil") && <p className="text-sm text-muted-foreground">You can view orders but not change them.</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border p-4 text-sm">
          <h2 className="mb-1 font-semibold">Customer</h2>
          <p>{order.customer.name}</p>
          <p className="text-muted-foreground">{order.customer.email}</p>
          {can("customers:view") && (
            <Link href={`/customers/${order.customer.id}`} className="mt-1 inline-block underline">
              View customer
            </Link>
          )}
        </section>
        <section className="rounded-xl border p-4 text-sm">
          <h2 className="mb-1 font-semibold">Ship to</h2>
          <p>{a.fullName}</p>
          <p>{a.line1}</p>
          {a.line2 && <p>{a.line2}</p>}
          <p>
            {a.city}
            {a.region ? `, ${a.region}` : ""} {a.postalCode}
          </p>
        </section>
        <section className="rounded-xl border p-4 text-sm">
          <h2 className="mb-1 font-semibold">Billing</h2>
          {can("billing:manage") ? (
            <>
              {order.invoice ? <p>Invoice {order.invoice.number}</p> : <p className="text-muted-foreground">No invoice (unpaid)</p>}
              {order.payments.map((p) => (
                <p key={p.id} className="text-muted-foreground">
                  <span className="capitalize">{p.status.replace("_", " ")}</span>
                  {p.cardLast4 && ` · ${p.cardBrand} ${p.cardLast4}`}
                  {p.failureReason && ` · ${p.failureReason.replace(/_/g, " ")}`}
                </p>
              ))}
            </>
          ) : (
            <p className="text-muted-foreground">Billing details are visible to owners only.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border">
        <ul className="divide-y text-sm">
          {order.items.map((i) => (
            <li key={i.sku} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                {i.productName} <span className="text-muted-foreground">· {i.variantLabel} · {i.sku}</span>
              </span>
              <span>
                {i.quantity} × {formatPrice(i.unitPriceCents)} = <strong>{formatPrice(i.unitPriceCents * i.quantity)}</strong>
              </span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto w-full max-w-xs space-y-1 border-t p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatPrice(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{formatPrice(order.shippingCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd>{formatPrice(order.taxCents)}</dd>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{formatPrice(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {order.refunds.length > 0 && (
        <section className="space-y-1 rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">Refunds</h2>
          {order.refunds.map((r) => (
            <p key={r.id}>
              {formatPrice(r.amountCents)} on {formatDateTime(r.createdAt)} <Badge className="bg-muted">{r.restock ? "restocked" : "not restocked"}</Badge>
              {r.reason && <span className="text-muted-foreground"> · {r.reason}</span>}
            </p>
          ))}
        </section>
      )}

      {refundable && can("orders:refund") && (
        <section className="space-y-3 rounded-xl border border-rose-200 p-4">
          <h2 className="font-semibold">Refund this order</h2>
          <p className="text-sm text-muted-foreground">Refunds the full amount (simulated). Owners only.</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put items back in stock
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              maxLength={200}
              className="h-9 min-w-64 rounded-lg border bg-background px-3 text-sm"
              aria-label="Refund reason"
            />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                window.confirm(`Refund ${formatPrice(order.totalCents)} to ${order.customer.name}?`) &&
                void act(() => api(`/admin/orders/${id}/refund`, { method: "POST", json: { restock, ...(reason.trim() ? { reason: reason.trim() } : {}) } }), "Order refunded")
              }
            >
              Refund {formatPrice(order.totalCents)}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <RequirePermission permission="orders:view">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <OrderView />
      </Suspense>
    </RequirePermission>
  );
}
