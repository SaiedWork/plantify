"use client";

import { useState } from "react";
import type { Role, StaffMember } from "@plantify/contracts";
import { ROLE_LABELS, STAFF_SWITCHABLE_ROLES } from "@plantify/contracts";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Badge, EmptyState, PageHeader, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function StaffPage() {
  const { data, loading, reload } = useApi<StaffMember[]>("/admin/staff");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ member: StaffMember; role: Role } | null>(null);

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
      <div>
        {loading && !data ? (
          <Skeleton className="h-40" />
        ) : !data || data.length === 0 ? (
          <EmptyState>No staff.</EmptyState>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Since</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((s) => (
                <tr key={s.id}>
                  <Td>{s.name}</Td>
                  <Td className="text-muted-foreground">{s.email}</Td>
                  <Td>
                    {s.role === "owner" ? (
                      <Badge className="bg-green-100 text-green-900 dark:bg-green-500/20 dark:text-green-300">{ROLE_LABELS.owner}</Badge>
                    ) : (
                      <Select
                        value={s.role}
                        disabled={busy}
                        onValueChange={(role) => role !== s.role && setPending({ member: s, role: role as Role })}
                        options={STAFF_SWITCHABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                        aria-label={`Role for ${s.name}`}
                        className="w-44"
                      />
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(s.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}

        <ConfirmDialog
          open={pending !== null}
          onOpenChange={(open) => !open && setPending(null)}
          title={pending ? `Make ${pending.member.name} the ${ROLE_LABELS[pending.role]}?` : ""}
          description={(() => {
            const other = pending && (data ?? []).find((m) => m.id !== pending.member.id && m.role === pending.role);
            return other ? `${other.name} currently holds this role and will become the ${ROLE_LABELS[pending!.member.role]}.` : "";
          })()}
          confirmLabel="Switch roles"
          busy={busy}
          onConfirm={async () => {
            if (pending) await act(() => api(`/admin/staff/${pending.member.id}`, { method: "PATCH", json: { role: pending.role } }), "Role updated");
            setPending(null);
          }}
        />

        <Alert className="mt-4">
          <Info />
          <AlertTitle>Staff management is intentionally minimal</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              <li>There are three fixed accounts: the owner, who always has full access and cannot be changed, a catalog manager and an order manager.</li>
              <li>Each manager role is held by exactly one person, so switching one person&apos;s role swaps it with the other.</li>
              <li>Catalog managers handle products, categories and inventory. Order managers handle orders and customers. Neither sees revenue, billing, refunds, webhooks, staff or the audit log.</li>
              <li>There are no invitations or access removal.</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </RequirePermission>
  );
}
