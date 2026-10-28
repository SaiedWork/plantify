"use client";

import Link from "next/link";
import type { OrderSummary } from "@plantify/contracts";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function AccountOverview() {
  const { data: session } = authClient.useSession();
  const { data: orders, loading } = useApi<OrderSummary[]>("/orders");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Hello{session ? `, ${session.user.name}` : ""}</h2>
        <p className="text-muted-foreground">Manage your orders, addresses and sign-in details.</p>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent orders</h3>
          <Link href="/account/orders" className="text-sm underline">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : !orders || orders.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No orders yet.{" "}
            <Link href="/shop" className="underline">
              Find your first plant
            </Link>
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex items-center justify-between gap-2 p-3 hover:bg-muted">
                  <span>
                    <span className="font-medium">{o.number}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(o.placedAt)}</span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <span className="text-sm">{formatPrice(o.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
