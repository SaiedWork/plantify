"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductListItem } from "@plantify/contracts";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";

/** One-click toggle on a product card: adds the cheapest in-stock size, and removes it again once it is in the cart. */
export function QuickAddButton({ product }: { product: ProductListItem }) {
  const router = useRouter();
  const { cart, add, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const variant = product.defaultVariant;
  const line = cart?.lines.find((l) => l.variantId === variant.id);

  async function onClick() {
    setBusy(true);
    if (line) {
      // Same as the cart page: no confirmation, but the toast can put the quantity back.
      if (await remove(variant.id)) {
        toast(`${product.name} (${variant.label}) removed`, {
          action: { label: "Undo", onClick: () => void add(variant.id, line.quantity) },
        });
      }
    } else if (await add(variant.id, 1)) {
      toast.success(`${product.name} (${variant.label}) added to your cart`, {
        action: { label: "View cart", onClick: () => router.push("/cart") },
      });
    }
    setBusy(false);
  }

  return (
    <Button
      variant={line ? "default" : "outline"}
      className="mt-3 w-full"
      aria-pressed={!!line}
      disabled={busy || (!line && !product.inStock)}
      onClick={onClick}
    >
      <ShoppingCart aria-hidden />
      {line ? "Remove from cart" : !product.inStock ? "Sold out" : "Add to cart"}
    </Button>
  );
}
