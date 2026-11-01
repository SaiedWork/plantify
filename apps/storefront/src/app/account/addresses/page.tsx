"use client";

import { useState, type SubmitEvent } from "react";
import type { AddressView } from "@plantify/contracts";
import { MAX_SAVED_ADDRESSES } from "@plantify/contracts";
import { toast } from "sonner";
import { AddressFields, EMPTY_ADDRESS, toAddressPayload, type AddressValues } from "@/components/address-fields";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";

type Editing = { id: string | null; values: AddressValues; makeDefault: boolean } | null;

const toValues = (a: AddressView): AddressValues => ({
  fullName: a.fullName,
  line1: a.line1,
  line2: a.line2 ?? "",
  city: a.city,
  region: a.region ?? "",
  postalCode: a.postalCode,
});

export default function AddressesPage() {
  const { data: addresses, loading, reload } = useApi<AddressView[]>("/addresses");
  const [editing, setEditing] = useState<Editing>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      reload();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: SubmitEvent) {
    e.preventDefault();
    if (!editing) return;
    const body = { ...toAddressPayload(editing.values), ...(editing.makeDefault ? { isDefault: true } : {}) };
    const ok = editing.id
      ? await run(() => api(`/addresses/${editing.id}`, { method: "PATCH", json: { ...body, line2: editing.values.line2.trim(), region: editing.values.region.trim() } }), "Address updated")
      : await run(() => api("/addresses", { method: "POST", json: body }), "Address saved");
    if (ok) setEditing(null);
  }

  const atLimit = (addresses?.length ?? 0) >= MAX_SAVED_ADDRESSES;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Addresses</h2>
        {!editing && (
          <Button disabled={atLimit} onClick={() => setEditing({ id: null, values: EMPTY_ADDRESS, makeDefault: false })}>
            Add address
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={onSave} className="space-y-4 rounded-xl border p-4">
          <h3 className="font-semibold">{editing.id ? "Edit address" : "New address"}</h3>
          <AddressFields value={editing.values} onChange={(values) => setEditing({ ...editing, values })} idPrefix="saved" />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.makeDefault}
              onChange={(e) => setEditing({ ...editing, makeDefault: e.target.checked })}
            />
            Use as my default address
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              Save address
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : !addresses || addresses.length === 0 ? (
        !editing && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No saved addresses yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-xl border p-4 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <p className="font-medium">{a.fullName}</p>
                {a.isDefault && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900">Default</span>}
              </div>
              <p>{a.line1}</p>
              {a.line2 && <p>{a.line2}</p>}
              <p>
                {a.city}
                {a.region ? `, ${a.region}` : ""} {a.postalCode}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditing({ id: a.id, values: toValues(a), makeDefault: false })}>
                  Edit
                </Button>
                {!a.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => run(() => api(`/addresses/${a.id}`, { method: "PATCH", json: { isDefault: true } }), "Default address updated")}
                  >
                    Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this address?")) {
                      void run(() => api(`/addresses/${a.id}`, { method: "DELETE" }), "Address deleted");
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {atLimit && <p className="text-xs text-muted-foreground">You&apos;ve reached the limit of {MAX_SAVED_ADDRESSES} saved addresses.</p>}
    </div>
  );
}
