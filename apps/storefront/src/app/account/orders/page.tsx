"use client";

import Link from "next/link";
import type { OrderSummary } from "@plantify/contracts";
import { Package } from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDate, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function OrdersPage() {
  const { data: orders, loading, error } = useApi<OrderSummary[]>("/orders");

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Order history</h2>
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : !orders || orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Package aria-hidden className="size-8" />
          <p>You haven&apos;t placed any orders yet.</p>
          <Link href="/shop" className="font-medium text-foreground underline underline-offset-4">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Items</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/account/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(o.placedAt)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">{o.itemCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPrice(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
