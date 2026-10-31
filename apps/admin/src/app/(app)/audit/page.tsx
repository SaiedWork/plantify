"use client";

import { RefreshCw } from "lucide-react";
import { Fragment, useState } from "react";
import type { AuditEntry, Page } from "@plantify/contracts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge, EmptyState, ErrorState, PageHeader, Pager, TableToolbar, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { qs } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";

const AREAS = [
  ["", "All activity"],
  ["product.", "Products"],
  ["variant.", "Variants"],
  ["image.", "Images"],
  ["category.", "Categories"],
  ["inventory.", "Inventory"],
  ["order.", "Orders"],
  ["webhook.", "Webhooks"],
  ["staff.", "Staff"],
] as const;

const AREA_STYLE: Record<string, string> = {
  product: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  variant: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  image: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  category: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300",
  inventory: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  order: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  webhook: "bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300",
  staff: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300",
};
const areaStyle = (action: string) => AREA_STYLE[action.split(".")[0]!] ?? "bg-muted";

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, error, reload } = useApi<Page<AuditEntry>>(`/admin/audit${qs({ action, page, pageSize: 15 })}`);

  return (
    <RequirePermission permission="staff:manage">
      <PageHeader title="Audit log" description="Who changed what. Entries are append-only and cleared with the weekly demo reset." />
      <TableToolbar total={data?.total}>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={AREAS.map(([value, label]) => ({ value, label }))}
          aria-label="Filter by area"
        />
        <Button variant="outline" onClick={reload}>
          <RefreshCw /> Refresh
        </Button>
      </TableToolbar>
      {loading && !data ? (
        <Skeleton />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No activity recorded.</EmptyState>
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((e) => (
                <Fragment key={e.id}>
                  <tr className="hover:bg-muted/40">
                    <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                    <Td className="whitespace-nowrap">{e.actor ? e.actor.name : <span className="text-muted-foreground">System</span>}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge className={`font-mono normal-case ${areaStyle(e.action)}`}>{e.action}</Badge>
                    </Td>
                    <Td className="min-w-40 max-w-52 font-mono text-xs break-all text-muted-foreground">{e.target ?? "—"}</Td>
                    <Td right>
                      {e.detail !== null && e.detail !== undefined && (
                        <Button variant="outline" onClick={() => setOpen(open === e.id ? null : e.id)}>
                          {open === e.id ? "Hide" : "Details"}
                        </Button>
                      )}
                    </Td>
                  </tr>
                  {open === e.id && (
                    <tr>
                      <td colSpan={5} className="bg-muted/30 p-3">
                        <pre className="max-h-48 overflow-auto rounded-lg border bg-background p-3 text-xs">{JSON.stringify(e.detail, null, 2)}</pre>
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
    </RequirePermission>
  );
}
