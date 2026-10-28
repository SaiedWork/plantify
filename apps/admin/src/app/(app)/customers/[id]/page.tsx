"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import type { CustomerDetail } from "@plantify/contracts";
import { EmptyState, OrderBadge, PageHeader, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

function CustomerView() {
  const { id } = useParams<{ id: string }>();
  const { data: c, loading, error } = useApi<CustomerDetail>(`/admin/customers/${id}`);

  if (loading) return <Skeleton className="h-64" />;
  if (error || !c) {
    return (
      <p>
        {error ?? "Customer not found."}{" "}
        <Link href="/customers" className="underline">
          Back to customers
        </Link>
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={c.name}
        description={c.email}
        actions={
          <Link href="/customers" className="inline-flex h-8 items-center px-3 text-sm underline">
            All customers
          </Link>
        }
      />
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ["Joined", formatDate(c.createdAt)],
          ["Orders", String(c.orderCount)],
          ["Lifetime spend", formatPrice(c.lifetimeCents)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-2">
        <h2 className="font-semibold">Orders</h2>
        {c.orders.length === 0 ? (
          <EmptyState>No orders yet.</EmptyState>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Status</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {c.orders.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/orders/${o.id}`} className="font-medium underline">
                      {o.number}
                    </Link>
                  </Td>
                  <Td>{formatDateTime(o.placedAt)}</Td>
                  <Td>
                    <OrderBadge status={o.status} />
                  </Td>
                  <Td right>{formatPrice(o.totalCents)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </div>
  );
}

export default function CustomerPage() {
  return (
    <RequirePermission permission="customers:view">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <CustomerView />
      </Suspense>
    </RequirePermission>
  );
}
