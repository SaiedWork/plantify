"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AdminOverview, DashboardStats, InventoryRow, Page } from "@plantify/contracts";
import { DASHBOARD_RANGES } from "@plantify/contracts";
import { useMe } from "@/components/admin-shell";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { AreaChart, BarList, longDate, moneyCompact, moneyFull, StatTile, Viz } from "@/components/charts";
import { EmptyState, ErrorState, orderStatusLabel, PageHeader, Skeleton } from "@/components/page-bits";
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

type Tone = "default" | "warn" | "bad";

function Stat({ label, value, hint, href, tone = "default" }: { label: string; value: number; hint?: string; href?: string; tone?: Tone }) {
  const body = (
    <Card size="sm" className={cn("h-full", href && "transition-colors hover:bg-muted/40")}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <p className={cn("text-3xl font-bold leading-none tabular-nums", tone === "warn" && "text-amber-700", tone === "bad" && "text-destructive")}>
          {value.toLocaleString("en-US")}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function StatGrid({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div>
    </section>
  );
}

/** Headline counts for roles that cannot see sales figures. */
function Overview({ days }: { days: number }) {
  const { data, loading, error } = useApi<AdminOverview>(`/admin/overview?days=${days}`);
  if (error) return <ErrorState />;
  if (loading && !data) return <Skeleton className="h-48" />;
  if (!data) return null;
  const { catalog, orders, customers } = data;

  const count = (n: number) => n.toLocaleString("en-US");
  const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {catalog && (
        <StatGrid title="Catalog">
          <Stat label="Products" value={catalog.products} hint={`${catalog.active} active · ${catalog.draft} draft · ${catalog.archived} archived`} href="/products" />
          <Stat label="Categories" value={catalog.categories} href="/categories" />
          <Stat label="Variants" value={catalog.variants} href="/inventory" />
          <Stat label="Low stock" value={catalog.lowStock} hint="At or below the alert level" tone={catalog.lowStock > 0 ? "warn" : "default"} href="/inventory?lowStock=true" />
          <Stat label="Out of stock" value={catalog.outOfStock} tone={catalog.outOfStock > 0 ? "bad" : "default"} href="/inventory?lowStock=true" />
        </StatGrid>
      )}
      {orders && (
        <StatGrid title="Orders">
          <Stat label="To process" value={orders.toProcess} hint="Paid, not started yet" tone={orders.toProcess > 0 ? "warn" : "default"} href="/orders" />
          <Stat label="Processing" value={orders.processing} href="/orders" />
          <Stat label="Shipped" value={orders.shipped} hint="On the way to customers" href="/orders" />
          <Stat label="Awaiting payment" value={orders.awaitingPayment} href="/orders" />
          <Stat label="Placed today" value={orders.placedToday} href="/orders" />
          {customers !== undefined && <Stat label="Customers" value={customers} href="/customers" />}
        </StatGrid>
      )}

      {catalog && (
        <Viz className="space-y-4">
          <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
            <AreaChart
              valueLabel="Units sold per day"
              summary={`Units sold per day over the last ${data.days} days: ${count(total(catalog.series.map((d) => d.units)))} in total.`}
              points={catalog.series.map((d) => ({ date: d.date, value: d.units }))}
              formatValue={(n) => `${count(n)} units`}
              formatTick={count}
              integerAxis
            />
            <p className="mt-2 text-xs text-[var(--viz-text-muted)]">Units leaving stock through sales, by day (UTC).</p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Stock health</h3>
              <BarList
                ariaLabel="Variants by stock level"
                items={[
                  { label: "In stock", value: catalog.variants - catalog.lowStock - catalog.outOfStock, valueLabel: String(catalog.variants - catalog.lowStock - catalog.outOfStock) },
                  { label: "Low stock", value: catalog.lowStock, valueLabel: String(catalog.lowStock) },
                  { label: "Out of stock", value: catalog.outOfStock, valueLabel: String(catalog.outOfStock) },
                ]}
              />
            </section>
            <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Best sellers by units</h3>
              {catalog.bestSellers.length === 0 ? (
                <p className="text-sm text-[var(--viz-text-muted)]">No sales in this period.</p>
              ) : (
                <BarList
                  ariaLabel="Best selling products by units"
                  items={catalog.bestSellers.map((p) => ({ label: p.name, value: p.units, valueLabel: String(p.units), detail: `${p.units} sold` }))}
                />
              )}
            </section>
            <section className="rounded-xl border lg:col-span-2 bg-[var(--viz-surface)] p-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Products by category</h3>
              <BarList
                ariaLabel="Products by category"
                items={catalog.productsByCategory.map((c) => ({ label: c.name, value: c.products, valueLabel: String(c.products), detail: `${c.products} ${c.products === 1 ? "product" : "products"}` }))}
              />
            </section>
          </div>
        </Viz>
      )}

      {orders && (
        <Viz className="space-y-4">
          <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
            <AreaChart
              valueLabel="Orders per day"
              summary={`Orders placed per day over the last ${data.days} days: ${count(total(orders.series.map((d) => d.orders)))} in total.`}
              points={orders.series.map((d) => ({ date: d.date, value: d.orders }))}
              formatValue={(n) => `${count(n)} ${n === 1 ? "order" : "orders"}`}
              formatTick={count}
              integerAxis
            />
            <p className="mt-2 text-xs text-[var(--viz-text-muted)]">Orders placed by day (UTC), whatever their status.</p>
          </section>
          <section className="rounded-xl border bg-[var(--viz-surface)] p-4">
            <h3 className="mb-3 text-sm font-medium text-[var(--viz-text-primary)]">Orders by status</h3>
            <BarList
              ariaLabel="Orders by status"
              items={orders.byStatus.map((s) => ({ label: capitalize(orderStatusLabel(s.status)), value: s.count, valueLabel: String(s.count), detail: `${s.count} ${s.count === 1 ? "order" : "orders"}` }))}
            />
          </section>
        </Viz>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { me, can } = useMe();
  const [days, setDays] = useState<number>(30);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${me.name.split(" ")[0]}`}
        description={can("dashboard:revenue") ? "How the shop is doing." : "Sales figures are visible to owners. Here is where things stand."}
        actions={<RangePicker days={days} onChange={setDays} />}
      />

      {can("dashboard:revenue") ? <Sales days={days} /> : <Overview days={days} />}

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
