"use client";

import Link from "next/link";
import { useState } from "react";
import type { CustomerListItem, Page } from "@plantify/contracts";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, PageHeader, Pager, TableToolbar, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { qs } from "@/lib/api-client";
import { formatDate, formatPrice } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi<Page<CustomerListItem>>(`/admin/customers${qs({ q: search, page, pageSize: 15 })}`);

  return (
    <RequirePermission permission="customers:view">
      <PageHeader title="Customers" description="Sorted by lifetime spend. Cancelled and refunded orders are not counted." />
      <TableToolbar total={data?.total}>
        <SearchInput
          placeholder="Search by name or email…"
          value={q}
          onValueChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          className="max-w-sm"
          aria-label="Search customers"
        />
      </TableToolbar>
      {loading && !data ? (
        <Skeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No customers match.</EmptyState>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Joined</Th>
                <Th right>Orders</Th>
                <Th right>Lifetime spend</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td>
                    <Link href={`/customers/${c.id}`} className="font-medium underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{c.email}</span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(c.createdAt)}</Td>
                  <Td right>{c.orderCount}</Td>
                  <Td right>{formatPrice(c.lifetimeCents)}</Td>
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
