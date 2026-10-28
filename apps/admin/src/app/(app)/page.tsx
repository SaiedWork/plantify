"use client";

import Link from "next/link";
import type { InventoryRow, Page } from "@plantify/contracts";
import { useMe } from "@/components/admin-shell";
import { EmptyState, PageHeader, Skeleton } from "@/components/page-bits";
import { useApi } from "@/lib/use-api";

function LowStock() {
  const { data, loading } = useApi<Page<InventoryRow>>("/admin/inventory?lowStock=true&pageSize=8");
  if (loading) return <Skeleton className="h-48" />;
  if (!data || data.items.length === 0) return <EmptyState>Nothing is running low. 🌱</EmptyState>;
  return (
    <ul className="divide-y rounded-xl border">
      {data.items.map((r) => (
        <li key={r.variantId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span>
            {r.productName} <span className="text-muted-foreground">· {r.label}</span>
          </span>
          <span className={r.onHand === 0 ? "font-medium text-destructive" : "font-medium text-amber-700"}>{r.onHand === 0 ? "Out of stock" : `${r.onHand} left`}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { me, can } = useMe();
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} description="Sales statistics arrive in the next milestone. For now, here is what needs attention." />
      {can("inventory:manage") && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Low stock</h2>
            <Link href="/inventory?lowStock=true" className="text-sm underline">
              Open inventory
            </Link>
          </div>
          <LowStock />
        </section>
      )}
    </div>
  );
}
