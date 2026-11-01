"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useState, type SubmitEvent } from "react";
import type { InventoryRow, Page, StockMovement } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search-input";
import { Badge, EmptyState, ErrorState, PageHeader, Pager, TableToolbar, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage, qs } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";
import { cn } from "@/lib/utils";

function History({ variantId }: { variantId: string }) {
  const { data, loading } = useApi<StockMovement[]>(`/admin/inventory/${variantId}/movements`);
  if (loading) return <Skeleton className="h-16" />;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No movements yet.</p>;
  return (
    <ul className="max-h-[calc(3*2rem+2px)] divide-y overflow-y-auto rounded-lg border bg-background text-xs">
      {data.map((m) => (
        <li key={m.id} className="flex h-8 shrink-0 items-center justify-between gap-3 px-3">
          <span className={cn("w-10 font-medium", m.delta < 0 ? "text-destructive" : "text-green-700 dark:text-green-400")}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
          <span className="w-20 capitalize">{m.reason}</span>
          <span className="flex-1 truncate text-muted-foreground">{m.note ?? (m.orderId ? "Order" : "")}</span>
          <span className="text-muted-foreground">{m.actorName ?? "System"}</span>
          <span className="text-muted-foreground">{formatDateTime(m.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function AdjustPanel({ row, onDone }: { row: InventoryRow; onDone: () => void }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<"restock" | "adjustment">("restock");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) {
      toast.error("Enter a whole number other than zero (use a minus sign to remove stock).");
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/inventory/${row.variantId}/adjust`, { method: "POST", json: { delta: n, reason, ...(note.trim() ? { note: note.trim() } : {}) } });
      toast.success("Stock updated");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 bg-muted/30 p-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`delta-${row.variantId}`} className="text-xs">Change (+/−)</Label>
          <Input id={`delta-${row.variantId}`} value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" placeholder="+10 or -2" className="w-28" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reason-${row.variantId}`} className="text-xs">Reason</Label>
          <Select
            id={`reason-${row.variantId}`}
            value={reason}
            onValueChange={(v) => setReason(v as "restock" | "adjustment")}
            options={[
              { value: "restock", label: "Restock" },
              { value: "adjustment", label: "Adjustment / damage" },
            ]}
          />
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor={`note-${row.variantId}`} className="text-xs">Note (optional)</Label>
          <Input id={`note-${row.variantId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </div>
        <Button type="submit" disabled={busy}>
          Apply
        </Button>
      </form>
      <History variantId={row.variantId} />
    </div>
  );
}

function InventoryTable() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  // The URL is the source of truth, so links such as "Open inventory" on the dashboard always apply the filter,
  // even when this page was already mounted with it unchecked.
  const router = useRouter();
  const lowOnly = params.get("lowStock") === "true";
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi<Page<InventoryRow>>(`/admin/inventory${qs({ q: search, lowStock: lowOnly ? "true" : "", page, pageSize: 15 })}`);

  return (
    <>
      <TableToolbar total={data?.total} className="gap-3">
        <SearchInput
          placeholder="Search by product or SKU…"
          value={q}
          onValueChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          className="max-w-xs"
          aria-label="Search inventory"
        />
        <Label htmlFor="low-only" className="h-8 cursor-pointer">
          <Checkbox
            id="low-only"
            checked={lowOnly}
            onCheckedChange={(checked) => {
              router.replace(checked ? "/inventory?lowStock=true" : "/inventory");
              setPage(1);
            }}
          />
          Low or out of stock only
        </Label>
      </TableToolbar>
      {loading && !data ? (
        <Skeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No variants match.</EmptyState>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th right>On hand</Th>
                <Th right>Alert at</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((r) => (
                <Fragment key={r.variantId}>
                  <tr className="hover:bg-muted/40">
                    <Td clamp className="min-w-52">
                      {r.productName} <span className="text-muted-foreground">· {r.label}</span>
                    </Td>
                    <Td className="font-mono text-xs whitespace-nowrap">{r.sku}</Td>
                    <Td right className="whitespace-nowrap">
                      <span className="mr-2 font-medium">{r.onHand}</span>
                      {r.onHand === 0 ? <Badge className="bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300">out</Badge> : r.isLow ? <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">low</Badge> : null}
                    </Td>
                    <Td right>{r.lowStockThreshold}</Td>
                    <Td right>
                      <Button size="sm" variant="outline" onClick={() => setOpen(open === r.variantId ? null : r.variantId)}>
                        {open === r.variantId ? "Close" : "Adjust"}
                      </Button>
                    </Td>
                  </tr>
                  {open === r.variantId && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <AdjustPanel
                          row={r}
                          onDone={() => {
                            setOpen(null);
                            reload();
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </TableShell>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}

export default function InventoryPage() {
  return (
    <RequirePermission permission="inventory:manage">
      <PageHeader title="Inventory" description="Stock levels per variant. Every change is logged." />
      <Suspense fallback={<Skeleton />}>
        <InventoryTable />
      </Suspense>
    </RequirePermission>
  );
}
