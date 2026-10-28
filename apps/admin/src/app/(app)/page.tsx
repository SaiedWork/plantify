"use client";

import Link from "next/link";
import { useState } from "react";
import type { DashboardStats, InventoryRow, Page } from "@plantify/contracts";
import { DASHBOARD_RANGES } from "@plantify/contracts";
import { useMe } from "@/components/admin-shell";
import { AreaChart, BarList, longDate, moneyCompact, moneyFull, StatTile, Viz } from "@/components/charts";
import { EmptyState, orderStatusLabel, PageHeader, Skeleton } from "@/components/page-bits";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function LowStock() {
  const { data, loading } = useApi<Page<InventoryRow>>("/admin/inventory?lowStock=true&pageSize=8");
  if (loading) return <Skeleton className="h-48" />;
  if (!data || data.items.length === 0) return <EmptyState>Nothing is running low.</EmptyState>;
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

function RangePicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div role="group" aria-label="Date range" className="inline-flex rounded-lg border p-0.5 text-sm">
      {DASHBOARD_RANGES.map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={d === days}
          onClick={() => onChange(d)}
          className={cn("rounded-md px-3 py-1 hover:bg-muted", d === days && "bg-muted font-medium")}
        >
          Last {d} days
        </button>
      ))}
    </div>
  );
}

function Sales({ days }: { days: number }) {
  const { data, loading, error } = useApi<DashboardStats>(`/admin/dashboard?days=${days}`);

  if (error) return <EmptyState>Could not load the statistics: {error}</EmptyState>;
  if (loading && !data) return <Skeleton className="h-96" />;
  if (!data) return null;

  const { kpis } = data;
  const period = `vs prior ${data.days} days`;
  const peak = data.series.reduce((best, d) => (d.revenueCents > best.revenueCents ? d : best), data.series[0]!);
  const summary = `Daily revenue over the last ${data.days} days: ${moneyFull(kpis.revenueCents.current)} in total, peaking at ${moneyFull(peak.revenueCents)} on ${longDate(peak.date)}.`;

  return (
    <Viz className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {/* The hero figure sits beside a 2×2 block of supporting tiles. */}
        <div className="md:col-span-2 md:row-span-2">
          <StatTile hero label="Revenue" value={moneyFull(kpis.revenueCents.current)} current={kpis.revenueCents.current} previous={kpis.revenueCents.previous} periodLabel={period} />
        </div>
        <StatTile label="Orders" value={kpis.orders.current.toLocaleString()} current={kpis.orders.current} previous={kpis.orders.previous} periodLabel={period} />
        <StatTile label="Average order" value={moneyFull(kpis.averageOrderCents.current)} current={kpis.averageOrderCents.current} previous={kpis.averageOrderCents.previous} periodLabel={period} />
        <StatTile label="New customers" value={kpis.newCustomers.current.toLocaleString()} current={kpis.newCustomers.current} previous={kpis.newCustomers.previous} periodLabel={period} />
        <StatTile label="Refunded" value={moneyFull(kpis.refundedCents.current)} current={kpis.refundedCents.current} previous={kpis.refundedCents.previous} upIsGood={false} periodLabel={period} />
      </div>

      <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
        <AreaChart
          valueLabel="Revenue per day"
          secondaryLabel="Orders"
          summary={summary}
          points={data.series.map((d) => ({ date: d.date, value: d.revenueCents, secondary: d.orders }))}
          formatTick={moneyCompact}
        />
        <p className="mt-2 text-xs text-[var(--viz-text-muted)]">Paid, processing, shipped and delivered orders by day (UTC). Refunded and cancelled orders are excluded.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Top products by revenue</h3>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-[var(--viz-text-muted)]">No sales in this period.</p>
          ) : (
            <BarList
              ariaLabel="Top products by revenue"
              items={data.topProducts.map((p) => ({ label: p.name, value: p.revenueCents, valueLabel: moneyCompact(p.revenueCents), detail: `${p.units} sold · ${moneyFull(p.revenueCents)}` }))}
            />
          )}
        </section>
        <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Revenue by category</h3>
          {data.categoryRevenue.length === 0 ? (
            <p className="text-sm text-[var(--viz-text-muted)]">No sales in this period.</p>
          ) : (
            <BarList
              ariaLabel="Revenue by category"
              items={data.categoryRevenue.map((c) => ({ label: c.name, value: c.revenueCents, valueLabel: moneyCompact(c.revenueCents), detail: moneyFull(c.revenueCents) }))}
            />
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Orders by status</h3>
        <BarList
          ariaLabel="Orders by status"
          items={data.ordersByStatus.map((s) => ({ label: capitalize(orderStatusLabel(s.status)), value: s.count, valueLabel: String(s.count), detail: `${s.count} ${s.count === 1 ? "order" : "orders"}` }))}
        />
      </section>
    </Viz>
  );
}

export default function Dashboard() {
  const { me, can } = useMe();
  const [days, setDays] = useState<number>(30);

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title={`Welcome, ${me.name.split(" ")[0]}`}
        description={can("dashboard:revenue") ? "How the shop is doing." : "Sales figures are visible to owners. Here is what needs attention in the catalog."}
        actions={can("dashboard:revenue") ? <RangePicker days={days} onChange={setDays} /> : undefined}
      />

      {can("dashboard:revenue") && <Sales days={days} />}

      {can("inventory:manage") && (
        <section className="max-w-2xl space-y-2">
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
