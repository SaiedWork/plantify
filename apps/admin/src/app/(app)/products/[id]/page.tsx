"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import type { AdminCategory, AdminProductDetail, AdminVariant, ProductStatus } from "@plantify/contracts";
import { MAX_IMAGES_PER_PRODUCT, PRODUCT_STATUSES } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, RequirePermission, Skeleton, TableShell, Td, Th } from "@/components/page-bits";
import { api, errorMessage } from "@/lib/api-client";
import { centsToDollars, dollarsToCents } from "@/lib/format";
import { imageSrc } from "@/lib/images";
import { useApi } from "@/lib/use-api";

/** Runs a mutation with a busy flag and toast feedback; returns whether it succeeded. */
function useAction(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, success: string) => {
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
  };
  return { busy, run };
}

function Details({ product, categories, reload }: { product: AdminProductDetail; categories: AdminCategory[]; reload: () => void }) {
  const { busy, run } = useAction(reload);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [featured, setFeatured] = useState(product.featured);

  const dirty =
    name !== product.name || description !== product.description || categoryId !== product.categoryId || status !== product.status || featured !== product.featured;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(
      () => api(`/admin/products/${product.id}`, { method: "PATCH", json: { name: name.trim(), description: description.trim(), categoryId, status, featured } }),
      "Product saved",
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-xl border p-4">
      <h2 className="font-semibold">Details</h2>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select id="category" value={categoryId} onValueChange={setCategoryId} options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))} className="w-full" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={status} onValueChange={(v) => setStatus(v as ProductStatus)} options={PRODUCT_STATUSES.map((s) => ({ value: s, label: s }))} className="w-full" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Featured
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Only <strong>active</strong> products appear in the store. Public URL: <code>/products/{product.slug}</code>
      </p>
      <Button type="submit" disabled={busy || !dirty}>
        Save details
      </Button>
    </form>
  );
}

function VariantRow({ variant, canDelete, reload }: { variant: AdminVariant; canDelete: boolean; reload: () => void }) {
  const { busy, run } = useAction(reload);
  const [label, setLabel] = useState(variant.label);
  const [sku, setSku] = useState(variant.sku);
  const [price, setPrice] = useState(centsToDollars(variant.priceCents));
  const [threshold, setThreshold] = useState(String(variant.lowStockThreshold));

  const priceCents = dollarsToCents(price);
  const dirty = label !== variant.label || sku !== variant.sku || priceCents !== variant.priceCents || Number(threshold) !== variant.lowStockThreshold;

  function save() {
    if (priceCents === null || !Number.isInteger(Number(threshold)) || Number(threshold) < 0) {
      toast.error("Enter a price above $0 and a whole-number threshold.");
      return;
    }
    void run(() => api(`/admin/variants/${variant.id}`, { method: "PATCH", json: { label: label.trim(), sku: sku.trim(), priceCents, lowStockThreshold: Number(threshold) } }), "Variant saved");
  }

  return (
    <tr>
      <Td>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Label" className="h-8 min-w-36" />
      </Td>
      <Td>
        <Input value={sku} onChange={(e) => setSku(e.target.value)} aria-label="SKU" className="h-8 w-36" />
      </Td>
      <Td>
        <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label="Price" className="h-8 w-24" />
      </Td>
      <Td>
        <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" aria-label="Low stock threshold" className="h-8 w-20" />
      </Td>
      <Td right>
        <Link href={`/inventory?q=${encodeURIComponent(variant.sku)}`} className="underline">
          {variant.stock}
        </Link>
      </Td>
      <Td right className="whitespace-nowrap">
        <Button size="sm" variant="outline" disabled={busy || !dirty} onClick={save}>
          Save
        </Button>{" "}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !canDelete}
          onClick={() => window.confirm(`Delete the "${variant.label}" variant?`) && void run(() => api(`/admin/variants/${variant.id}`, { method: "DELETE" }), "Variant deleted")}
        >
          Delete
        </Button>
      </Td>
    </tr>
  );
}

function Variants({ product, reload }: { product: AdminProductDetail; reload: () => void }) {
  const { busy, run } = useAction(reload);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");

  async function add(e: FormEvent) {
    e.preventDefault();
    const priceCents = dollarsToCents(price);
    if (priceCents === null || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      toast.error("Enter a price above $0 and a whole-number stock.");
      return;
    }
    const ok = await run(() => api(`/admin/products/${product.id}/variants`, { method: "POST", json: { label: label.trim(), priceCents, initialStock: Number(stock) } }), "Variant added");
    if (ok) {
      setLabel("");
      setPrice("");
      setStock("0");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Variants</h2>
      <TableShell>
        <thead>
          <tr>
            <Th>Label</Th>
            <Th>SKU</Th>
            <Th>Price ($)</Th>
            <Th>Low-stock at</Th>
            <Th right>In stock</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y">
          {product.variants.map((v) => (
            // Keyed by server values so rows reset after a save/reload.
            <VariantRow key={`${v.id}:${v.label}:${v.sku}:${v.priceCents}:${v.lowStockThreshold}`} variant={v} canDelete={product.variants.length > 1} reload={reload} />
          ))}
        </tbody>
      </TableShell>
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">New variant</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jumbo (10 in)" required maxLength={60} className="w-48" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Price ($)</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required className="w-24" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stock</Label>
          <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" required className="w-20" />
        </div>
        <Button type="submit" variant="outline" disabled={busy || product.variants.length >= 10}>
          Add variant
        </Button>
      </form>
    </section>
  );
}

function Images({ product, reload }: { product: AdminProductDetail; reload: () => void }) {
  const { busy, run } = useAction(reload);
  const [url, setUrl] = useState("");
  const full = product.images.length >= MAX_IMAGES_PER_PRODUCT;

  async function upload(file: File) {
    const body = new FormData();
    body.append("file", file);
    await run(async () => {
      const { url } = await api<{ url: string }>("/admin/uploads", { method: "POST", body });
      await api(`/admin/products/${product.id}/images`, { method: "POST", json: { url, alt: product.name } });
    }, "Image uploaded");
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">
        Images <span className="text-sm font-normal text-muted-foreground">({product.images.length}/{MAX_IMAGES_PER_PRODUCT}, first is the cover)</span>
      </h2>
      {product.images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {product.images.map((img, i) => (
            <li key={img.id} className="space-y-1 rounded-xl border p-2">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <Image src={imageSrc(img.url)} alt={img.alt} fill unoptimized className="object-cover" />
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {i === 0 ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-900">Cover</span>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => api(`/admin/images/${img.id}/primary`, { method: "POST" }), "Cover image updated")}>
                    Make cover
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api(`/admin/images/${img.id}`, { method: "DELETE" }), "Image removed")}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!full ? (
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="file" className="text-xs">
              Upload (JPEG, PNG or WebP, up to 1 MB)
            </Label>
            <input
              id="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
              className="block text-sm"
            />
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => api(`/admin/products/${product.id}/images`, { method: "POST", json: { url: url.trim(), alt: product.name } }), "Image added")) setUrl("");
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="imageUrl" className="text-xs">
                …or an https:// image URL
              </Label>
              <Input id="imageUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-72" />
            </div>
            <Button type="submit" variant="outline" disabled={busy || !url.trim()}>
              Add
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Image limit reached. Remove one to add another.</p>
      )}
    </section>
  );
}

function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: product, error, loading, reload } = useApi<AdminProductDetail>(`/admin/products/${id}`);
  const { data: categories } = useApi<AdminCategory[]>("/admin/categories");
  const [deleting, setDeleting] = useState(false);

  if (loading) return <Skeleton className="h-96" />;
  if (error || !product) {
    return (
      <p>
        {error ?? "Product not found."}{" "}
        <Link href="/products" className="underline">
          Back to products
        </Link>
      </p>
    );
  }

  async function remove() {
    if (!window.confirm(`Delete "${product!.name}" permanently?`)) return;
    setDeleting(true);
    try {
      await api(`/admin/products/${id}`, { method: "DELETE" });
      toast.success("Product deleted");
      router.push("/products");
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={product.name}
        description={product.status === "active" ? "Visible in the store." : `Not visible in the store (${product.status}).`}
        actions={
          <>
            <Link href="/products" className="inline-flex h-8 items-center px-3 text-sm underline">
              All products
            </Link>
            <Button variant="outline" disabled={deleting} onClick={remove}>
              Delete product
            </Button>
          </>
        }
      />
      {/* Keyed so the form re-initialises from the server after every save. */}
      {categories && <Details key={`${product.name}:${product.description}:${product.categoryId}:${product.status}:${product.featured}`} product={product} categories={categories} reload={reload} />}
      <Variants product={product} reload={reload} />
      <Images product={product} reload={reload} />
    </div>
  );
}

export default function ProductPage() {
  return (
    <RequirePermission permission="catalog:manage">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ProductEditor />
      </Suspense>
    </RequirePermission>
  );
}
