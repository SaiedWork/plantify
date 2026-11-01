"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { AdminProductListItem, Page, ProductStatus } from "@plantify/contracts";
import { PRODUCT_STATUSES } from "@plantify/contracts";
import { buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, PageHeader, Pager, TableToolbar, ProductBadge, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { qs } from "@/lib/api-client";
import { formatPrice, capitalize } from "@/lib/format";
import { imageSrc } from "@/lib/images";
import { useApi, useDebounced } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProductStatus | "">("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi<Page<AdminProductListItem>>(`/admin/products${qs({ q: search, status, page, pageSize: 15 })}`);

  return (
    <RequirePermission permission="catalog:manage">
      <PageHeader
        title="Products"
        description="Everything in the catalog, including drafts and archived items."
        actions={
          <Link href="/products/new" className={cn(buttonVariants())}>
            <Plus /> Add product
          </Link>
        }
      />
      <TableToolbar total={data?.total}>
        <SearchInput
          placeholder="Search by name…"
          value={q}
          onValueChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search products"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as ProductStatus | "");
            setPage(1);
          }}
          options={[{ value: "", label: "All statuses" }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: capitalize(s) }))]}
          aria-label="Filter by status"
        />
      </TableToolbar>

      {loading && !data ? (
        <Skeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No products match.</EmptyState>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th right>Variants</Th>
                <Th right>Stock</Th>
                <Th right>From</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-muted/40">
                  <Td>
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {p.imageUrl && <Image src={imageSrc(p.imageUrl)} alt="" fill unoptimized className="object-cover" />}
                      </span>
                      <span>
                        {p.name}
                        {p.featured && <span className="ml-2 text-xs text-amber-700">★ featured</span>}
                      </span>
                    </Link>
                  </Td>
                  <Td>{p.category.name}</Td>
                  <Td>
                    <ProductBadge status={p.status} />
                  </Td>
                  <Td right>{p.variantCount}</Td>
                  <Td right className={p.stock === 0 ? "text-destructive" : undefined}>
                    {p.stock}
                  </Td>
                  <Td right>{formatPrice(p.minPriceCents)}</Td>
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
