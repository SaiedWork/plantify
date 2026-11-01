"use client";

import Link from "next/link";
import type { OrderSummary } from "@plantify/contracts";
import { ChevronRight, Package } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDate, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

export default function AccountOverview() {
  const { data: orders, loading, error } = useApi<OrderSummary[]>("/orders");
  // Cancelled and refunded orders are not money the customer spent.
  const spent = (orders ?? []).filter((o) => o.status !== "cancelled" && o.status !== "refunded" && o.status !== "pending_payment");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">Manage your orders, addresses and sign-in details.</p>
      </div>

      {!loading && orders && orders.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Orders" value={String(orders.length)} />
          <Stat label="Total spent" value={formatPrice(spent.reduce((n, o) => n + o.totalCents, 0))} />
          <Stat label="Last order" value={formatDate(orders[0]!.placedAt)} />
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent orders</h3>
          <Link href="/account/orders" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : error && !orders ? (
          <p role="alert" className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            We couldn&apos;t load your orders. Refresh to try again.
          </p>
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Package aria-hidden className="size-8" />
            <p>No orders yet.</p>
            <Link href="/shop" className="font-medium text-foreground underline underline-offset-4">
              Find your first plant
            </Link>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.number}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(o.placedAt)}</span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <span className="w-20 text-right text-sm tabular-nums">{formatPrice(o.totalCents)}</span>
                  <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
