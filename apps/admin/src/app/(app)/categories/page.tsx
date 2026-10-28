"use client";

import { useState, type FormEvent } from "react";
import type { AdminCategory } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, PageHeader, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";

function Row({ category, reload }: { category: AdminCategory; reload: () => void }) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== category.name || description.trim() !== (category.description ?? "");

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <Td>
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" className="h-8 min-w-40" />
      </Td>
      <Td>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" className="h-8 min-w-56" />
      </Td>
      <Td right>{category.productCount}</Td>
      <Td right className="whitespace-nowrap">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !dirty}
          onClick={() => act(() => api(`/admin/categories/${category.id}`, { method: "PATCH", json: { name: name.trim(), description: description.trim() } }), "Category saved")}
        >
          Save
        </Button>{" "}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || category.productCount > 0}
          title={category.productCount > 0 ? "Move its products to another category first" : undefined}
          onClick={() => window.confirm(`Delete "${category.name}"?`) && void act(() => api(`/admin/categories/${category.id}`, { method: "DELETE" }), "Category deleted")}
        >
          Delete
        </Button>
      </Td>
    </tr>
  );
}

export default function CategoriesPage() {
  const { data, loading, reload } = useApi<AdminCategory[]>("/admin/categories");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/categories", { method: "POST", json: { name: name.trim() } });
      toast.success("Category added");
      setName("");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequirePermission permission="catalog:manage">
      <PageHeader title="Categories" description="Group products so shoppers can browse them." />
      {loading && !data ? (
        <Skeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState>No categories yet.</EmptyState>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th right>Products</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((c) => (
              <Row key={`${c.id}:${c.name}:${c.description}`} category={c} reload={reload} />
            ))}
          </tbody>
        </TableShell>
      )}
      <form onSubmit={add} className="mt-4 flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="newCategory" className="text-xs">
            New category
          </Label>
          <Input id="newCategory" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} className="w-64" />
        </div>
        <Button type="submit" variant="outline" disabled={busy}>
          Add category
        </Button>
      </form>
    </RequirePermission>
  );
}
