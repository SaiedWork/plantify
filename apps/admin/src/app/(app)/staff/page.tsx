"use client";

import { useState } from "react";
import type { StaffMember } from "@plantify/contracts";
import { ROLE_LABELS, STAFF_SWITCHABLE_ROLES } from "@plantify/contracts";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Badge, EmptyState, PageHeader, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function StaffPage() {
  const { data, loading, reload } = useApi<StaffMember[]>("/admin/staff");
  const [busy, setBusy] = useState(false);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      reload();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequirePermission permission="staff:manage">
      <PageHeader
        title="Staff & roles"
        description="Switch roles between the demo catalog and order managers."
      />
      <div className="max-w-3xl">
        {loading && !data ? (
          <Skeleton className="h-40" />
        ) : !data || data.length === 0 ? (
          <EmptyState>No staff.</EmptyState>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Since</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((s) => (
                <tr key={s.id}>
                  <Td>
                    {s.name}
                    <span className="block text-xs text-muted-foreground">{s.email}</span>
                  </Td>
                  <Td>
                    {s.role === "owner" ? (
                      <Badge className="bg-green-100 text-green-900">{ROLE_LABELS.owner}</Badge>
                    ) : (
                      <Select
                        value={s.role}
                        disabled={busy}
                        onValueChange={(role) => act(() => api(`/admin/staff/${s.id}`, { method: "PATCH", json: { role } }), "Role updated")}
                        options={STAFF_SWITCHABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                        aria-label={`Role for ${s.name}`}
                      />
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(s.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}

        <Alert className="mt-4">
          <Info />
          <AlertTitle>Staff management is intentionally minimal</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              <li>The three staff accounts are fixed, and only the role switch is kept working.</li>
              <li>The owner always keeps full access and cannot be changed.</li>
              <li>The catalog manager and order manager each hold exactly one role, so picking a role for one swaps it with the other.</li>
              <li>Catalog managers manage products, categories and inventory.</li>
              <li>Order managers work orders and see customers.</li>
              <li>Each dashboard shows counts only for their own area. Neither role sees revenue, billing, refunds, webhooks, staff or the audit log.</li>
              <li>There are no invitations or access removal.</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </RequirePermission>
  );
}
