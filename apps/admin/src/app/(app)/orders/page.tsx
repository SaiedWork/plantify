"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminOrderListItem, OrderStatus, Page } from "@plantify/contracts";
import { ORDER_STATUSES } from "@plantify/contracts";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, OrderBadge, orderStatusLabel, PageHeader, Pager, TableToolbar, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { qs } from "@/lib/api-client";
import { formatDateTime, formatPrice } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";

export default function OrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi<Page<AdminOrderListItem>>(`/admin/orders${qs({ q: search, status, page, pageSize: 15 })}`);

  return (
    <RequirePermission permission="orders:view">
      <PageHeader title="Orders" description="Newest first." />
      <TableToolbar total={data?.total}>
        <SearchInput
          placeholder="Order number, customer name or email…"
          value={q}
          onValueChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          className="max-w-sm"
          aria-label="Search orders"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as OrderStatus | "");
            setPage(1);
          }}
          options={[{ value: "", label: "All statuses" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(s) }))]}
          aria-label="Filter by status"
        />
      </TableToolbar>
      {loading && !data ? (
        <Skeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No orders match.</EmptyState>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th right>Items</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <Td>
                    <Link href={`/orders/${o.id}`} className="font-medium whitespace-nowrap underline">
                      {o.number}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDateTime(o.placedAt)}</Td>
                  <Td clamp>
                    {o.customer.name}
                    <span className="block text-xs text-muted-foreground">{o.customer.email}</span>
                  </Td>
                  <Td>
                    <OrderBadge status={o.status} />
                  </Td>
                  <Td right>{o.itemCount}</Td>
                  <Td right className="whitespace-nowrap">{formatPrice(o.totalCents)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </RequirePermission>
  );
}
