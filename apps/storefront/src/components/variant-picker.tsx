"use client";

import { useState } from "react";
import type { ProductVariantDetail } from "@plantify/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

export function VariantPicker({ variants }: { variants: ProductVariantDetail[] }) {
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0]!;
  const [selectedId, setSelectedId] = useState(firstAvailable.id);
  const selected = variants.find((v) => v.id === selectedId)!;

  const stockNote =
    selected.stock === 0
      ? "Sold out"
      : selected.stock <= selected.lowStockThreshold
        ? `Only ${selected.stock} left`
        : "In stock";

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
              onClick={() => setSelectedId(v.id)}
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

      {/* Cart arrives in milestone 4. */}
      <Button size="lg" disabled className="w-full sm:w-auto" title="The cart is built in the next milestone">
        Add to cart
      </Button>
    </div>
  );
}
