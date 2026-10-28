"use client";

import Link from "next/link";
import type { OrderSummary } from "@plantify/contracts";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatDate, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function OrdersPage() {
  const { data: orders, loading, error } = useApi<OrderSummary[]>("/orders");

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Order history</h2>
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : !orders || orders.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          You haven&apos;t placed any orders yet.{" "}
          <Link href="/shop" className="underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Items</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link href={`/account/orders/${o.id}`} className="font-medium underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{formatDate(o.placedAt)}</td>
                  <td className="px-3 py-2">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-2 text-right">{o.itemCount}</td>
                  <td className="px-3 py-2 text-right">{formatPrice(o.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
