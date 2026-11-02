"use client";

import { useState, type SubmitEvent } from "react";
import type { AddressView } from "@plantify/contracts";
import { MAX_SAVED_ADDRESSES } from "@plantify/contracts";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddressFields, EMPTY_ADDRESS, toAddressPayload, type AddressValues } from "@/components/address-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
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
  const [deleting, setDeleting] = useState<AddressView | null>(null);

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
    const body = { ...toAddressPayload(editing.values), ...(editing.makeDefault && !defaultLocked ? { isDefault: true } : {}) };
    const ok = editing.id
      ? await run(() => api(`/addresses/${editing.id}`, { method: "PATCH", json: { ...body, line2: editing.values.line2.trim(), region: editing.values.region.trim() } }), "Address updated")
      : await run(() => api("/addresses", { method: "POST", json: body }), "Address saved");
    if (ok) setEditing(null);
  }

  const atLimit = (addresses?.length ?? 0) >= MAX_SAVED_ADDRESSES;
  // The first address and the current default stay default; another address has to take over instead.
  const defaultLocked = editing
    ? editing.id
      ? (addresses?.find((a) => a.id === editing.id)?.isDefault ?? false)
      : (addresses?.length ?? 0) === 0
    : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Addresses</h2>
        <Button disabled={atLimit} onClick={() => setEditing({ id: null, values: EMPTY_ADDRESS, makeDefault: false })}>
          <Plus aria-hidden /> Add address
        </Button>
      </div>

      <FormDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title={editing?.id ? "Edit address" : "New address"}>
        {editing && (
          <form onSubmit={onSave} className="space-y-4">
            <AddressFields
              value={editing.values}
              onChange={(values) => setEditing({ ...editing, values })}
              idPrefix="saved"
              zipAside={
                <label className="flex w-fit items-center gap-2">
                  <Checkbox
                    checked={defaultLocked || editing.makeDefault}
                    disabled={defaultLocked}
                    onCheckedChange={(checked) => setEditing({ ...editing, makeDefault: checked === true })}
                  />
                  Use as default address
                </label>
              }
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save address
              </Button>
            </div>
          </form>
        )}
      </FormDialog>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : !addresses || addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <MapPin aria-hidden className="size-8" />
          <p>No saved addresses yet.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-xl border bg-card p-5 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <p className="font-medium">{a.fullName}</p>
                {a.isDefault && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900 dark:bg-green-950 dark:text-green-200">Default</span>}
              </div>
              <p>{a.line1}</p>
              {a.line2 && <p>{a.line2}</p>}
              <p>
                {a.city}
                {a.region ? `, ${a.region}` : ""} {a.postalCode}
              </p>
              <div className="mt-auto flex justify-end gap-1 pt-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit address for ${a.fullName}`}
                  title="Edit"
                  onClick={() => setEditing({ id: a.id, values: toValues(a), makeDefault: false })}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-destructive"
                  aria-label={`Delete address for ${a.fullName}`}
                  title="Delete"
                  disabled={busy}
                  onClick={() => setDeleting(a)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this address?"
        description={deleting ? `${deleting.fullName}, ${deleting.line1}, ${deleting.city} will be removed from your saved addresses.` : ""}
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={async () => {
          if (!deleting) return;
          await run(() => api(`/addresses/${deleting.id}`, { method: "DELETE" }), "Address deleted");
          setDeleting(null);
        }}
      />
      {atLimit && <p className="text-xs text-muted-foreground">You&apos;ve reached the limit of {MAX_SAVED_ADDRESSES} saved addresses.</p>}
    </div>
  );
}
