"use client";

import { useState, type FormEvent } from "react";
import type { StaffMember } from "@plantify/contracts";
import { STAFF_GRANTABLE_ROLES } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/components/admin-shell";
import { EmptyState, PageHeader, RequirePermission, selectClass, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";

const ROLE_LABEL: Record<StaffMember["role"], string> = { owner: "Owner", catalog_manager: "Catalog manager" };

export default function StaffPage() {
  const { me } = useMe();
  const { data, loading, reload } = useApi<StaffMember[]>("/admin/staff");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffMember["role"]>("catalog_manager");
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

  async function grant(e: FormEvent) {
    e.preventDefault();
    if (await act(() => api("/admin/staff", { method: "POST", json: { email: email.trim(), role } }), "Access granted")) setEmail("");
  }

  return (
    <RequirePermission permission="staff:manage">
      <PageHeader title="Staff & roles" description="Owners have full access. Catalog managers handle products, inventory and fulfilment, but not billing, refunds, customers or settings." />
      <div className="max-w-3xl space-y-8">
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
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((s) => {
                const isMe = s.id === me.id;
                return (
                  <tr key={s.id}>
                    <Td>
                      {s.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                      <span className="block text-xs text-muted-foreground">{s.email}</span>
                    </Td>
                    <Td>
                      <select
                        value={s.role}
                        disabled={busy || isMe}
                        title={isMe ? "You can't change your own role" : undefined}
                        onChange={(e) => act(() => api(`/admin/staff/${s.id}`, { method: "PATCH", json: { role: e.target.value } }), "Role updated")}
                        className={selectClass}
                        aria-label={`Role for ${s.name}`}
                      >
                        {STAFF_GRANTABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>{formatDate(s.createdAt)}</Td>
                    <Td right>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || isMe}
                        onClick={() => window.confirm(`Remove staff access for ${s.name}? They become a regular customer and are signed out.`) && void act(() => api(`/admin/staff/${s.id}`, { method: "DELETE" }), "Access removed")}
                      >
                        Remove access
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}

        <form onSubmit={grant} className="space-y-3 rounded-xl border border-dashed p-4">
          <h2 className="font-semibold">Give someone staff access</h2>
          <p className="text-sm text-muted-foreground">They need a verified account first: ask them to sign up in the store, then enter the same email here.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="staff-email" className="text-xs">
                Email
              </Label>
              <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} className="w-72" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="staff-role" className="text-xs">
                Role
              </Label>
              <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as StaffMember["role"])} className={selectClass}>
                {STAFF_GRANTABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={busy || !email.trim()}>
              Grant access
            </Button>
          </div>
        </form>
      </div>
    </RequirePermission>
  );
}
