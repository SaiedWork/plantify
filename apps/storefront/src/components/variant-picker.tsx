"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProductVariantDetail } from "@plantify/contracts";
import { MAX_QTY_PER_LINE } from "@plantify/contracts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

export function VariantPicker({ variants, productName }: { variants: ProductVariantDetail[]; productName: string }) {
  const router = useRouter();
  const { add } = useCart();
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0]!;
  const [selectedId, setSelectedId] = useState(firstAvailable.id);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const selected = variants.find((v) => v.id === selectedId)!;
  const maxQty = Math.max(1, Math.min(selected.stock, MAX_QTY_PER_LINE));

  const stockNote =
    selected.stock === 0
      ? "Sold out"
      : selected.stock <= selected.lowStockThreshold
        ? `Only ${selected.stock} left`
        : "In stock";

  async function addToCart() {
    setBusy(true);
    const ok = await add(selected.id, Math.min(quantity, maxQty));
    setBusy(false);
    if (ok) {
      toast.success(`${productName} (${selected.label}) added to your cart`, {
        action: { label: "View cart", onClick: () => router.push("/cart") },
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold">{formatPrice(selected.priceCents)}</p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Size</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setSelectedId(v.id);
                setQuantity(1);
              }}
              aria-pressed={v.id === selectedId}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted",
                v.id === selectedId && "border-green-800 bg-green-50 ring-1 ring-green-800",
                v.stock === 0 && "text-muted-foreground line-through",
              )}
            >
              <span className="block">{v.label}</span>
              <span className="text-xs text-muted-foreground">{formatPrice(v.priceCents)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <p className={cn("text-sm", selected.stock === 0 ? "text-destructive" : selected.stock <= selected.lowStockThreshold ? "text-amber-700" : "text-green-800")}>
        {stockNote}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Qty
          <select
            value={Math.min(quantity, maxQty)}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={selected.stock === 0}
            className="h-9 rounded-lg border bg-background px-2"
          >
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button size="lg" disabled={selected.stock === 0 || busy} onClick={addToCart}>
          {selected.stock === 0 ? "Sold out" : busy ? "Adding…" : "Add to cart"}
        </Button>
        <Link href="/cart" className="text-sm underline">
          View cart
        </Link>
      </div>
    </div>
  );
}
