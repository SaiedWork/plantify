"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { CustomerDetail } from "@plantify/contracts";
import { useBreadcrumbLabel } from "@/components/app-header";
import { EmptyState, OrderBadge, PageHeader, Pager, RequirePermission, Skeleton, TableShell, TableToolbar, Td, Th } from "@/components/page-bits";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { useApi } from "@/lib/use-api";

const PAGE_SIZE = 15;

function CustomerView() {
  const { id } = useParams<{ id: string }>();
  const { data: c, loading, error } = useApi<CustomerDetail>(`/admin/customers/${id}`);
  const [page, setPage] = useState(1);
  useBreadcrumbLabel(c?.name);

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

  const current = Math.min(page, Math.max(1, Math.ceil(c.orders.length / PAGE_SIZE)));

  return (
    <div className="space-y-6">
      <PageHeader title={c.name} description={c.email} />
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
      <p className="-mt-3 text-xs text-muted-foreground">Orders and lifetime spend leave out cancelled and refunded orders.</p>
      <section>
        <TableToolbar total={c.orders.length}>
          <h2 className="font-semibold">Orders</h2>
        </TableToolbar>
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
              {c.orders.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/orders/${o.id}`} className="font-medium underline">
                      {o.number}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDateTime(o.placedAt)}</Td>
                  <Td>
                    <OrderBadge status={o.status} />
                  </Td>
                  <Td right>{formatPrice(o.totalCents)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        <Pager page={current} pageSize={PAGE_SIZE} total={c.orders.length} onPage={setPage} />
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
