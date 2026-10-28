"use client";

import { Fragment, useState } from "react";
import type { AuditEntry, Page } from "@plantify/contracts";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Pager, RequirePermission, selectClass, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
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

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, loading, reload } = useApi<Page<AuditEntry>>(`/admin/audit${qs({ action, page, pageSize: 20 })}`);

  return (
    <RequirePermission permission="staff:manage">
      <PageHeader title="Audit log" description="Who changed what. Entries are append-only and cleared with the weekly demo reset." />
      <div className="mb-4 flex gap-2">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={selectClass} aria-label="Filter by area">
          {AREAS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={reload}>
          Refresh
        </Button>
      </div>
      {loading && !data ? (
        <Skeleton />
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
                    <Td>{e.actor ? e.actor.name : <span className="text-muted-foreground">System</span>}</Td>
                    <Td>
                      <code className="text-xs">{e.action}</code>
                    </Td>
                    <Td className="max-w-40 truncate font-mono text-xs text-muted-foreground">{e.target ?? "—"}</Td>
                    <Td right>
                      {e.detail !== null && e.detail !== undefined && (
                        <Button size="sm" variant="ghost" onClick={() => setOpen(open === e.id ? null : e.id)}>
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
