"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminOrderListItem, OrderStatus, Page } from "@plantify/contracts";
import { ORDER_STATUSES } from "@plantify/contracts";
import { Input } from "@/components/ui/input";
import { EmptyState, OrderBadge, orderStatusLabel, PageHeader, Pager, RequirePermission, selectClass, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { qs } from "@/lib/api-client";
import { formatDateTime, formatPrice } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";

export default function OrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading } = useApi<Page<AdminOrderListItem>>(`/admin/orders${qs({ q: search, status, page, pageSize: 20 })}`);

  return (
    <RequirePermission permission="orders:view">
      <PageHeader title="Orders" description="Newest first." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Order number, customer name or email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
          aria-label="Search orders"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | "");
            setPage(1);
          }}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      {loading && !data ? (
        <Skeleton />
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
                    <Link href={`/orders/${o.id}`} className="font-medium underline">
                      {o.number}
                    </Link>
                  </Td>
                  <Td>{formatDateTime(o.placedAt)}</Td>
                  <Td>
                    {o.customer.name}
                    <span className="block text-xs text-muted-foreground">{o.customer.email}</span>
                  </Td>
                  <Td>
                    <OrderBadge status={o.status} />
                  </Td>
                  <Td right>{o.itemCount}</Td>
                  <Td right>{formatPrice(o.totalCents)}</Td>
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
