"use client";

import Image from "next/image";
import Link from "next/link";
import { MAX_QTY_PER_LINE } from "@plantify/contracts";
import { Trash2 } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { useCart } from "@/components/cart-provider";
import { OrderTotals } from "@/components/order-totals";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CartPage() {
  const { cart, setQuantity, remove } = useCart();

  if (!cart) return <div className="mx-auto h-64 max-w-5xl animate-pulse px-4 py-10" />;

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">Plants are waiting for a home.</p>
        <Link href="/shop" className={cn(buttonVariants(), "mt-6")}>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Your cart</h1>
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <ul className="divide-y rounded-xl border">
          {cart.lines.map((line) => {
            const max = Math.max(1, Math.min(line.stock, MAX_QTY_PER_LINE));
            const over = line.quantity > line.stock;
            return (
              <li key={line.variantId} className="flex gap-4 p-4">
                <Link href={`/products/${line.productSlug}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {line.imageUrl && <Image src={line.imageUrl} alt={line.productName} fill unoptimized className="object-cover" />}
                </Link>
                <div className="flex-1">
                  <Link href={`/products/${line.productSlug}`} className="font-medium hover:underline">
                    {line.productName}
                  </Link>
                  <p className="text-sm text-muted-foreground">{line.variantLabel}</p>
                  {over && (
                    <p className="text-sm text-destructive">
                      {line.stock === 0 ? "Sold out. Remove it to continue." : `Only ${line.stock} left. Lower the quantity to continue.`}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      Qty
                      <select
                        value={Math.min(line.quantity, max)}
                        onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                        className="h-8 rounded-lg border bg-background px-2"
                        disabled={line.stock === 0}
                      >
                        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => remove(line.variantId)} aria-label={`Remove ${line.productName}`}>
                      <Trash2 className="size-4" /> Remove
                    </Button>
                  </div>
                </div>
                <p className="font-medium">{formatPrice(line.lineTotalCents)}</p>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit space-y-4 rounded-xl border p-4">
          <h2 className="font-semibold">Order summary</h2>
          <OrderTotals totals={cart} />
          {cart.lines.some((l) => l.quantity > l.stock) ? (
            <Button className="w-full" disabled>
              Fix your cart to continue
            </Button>
          ) : (
            <Link href="/checkout" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
              Checkout
            </Link>
          )}
          <p className="text-xs text-muted-foreground">Free shipping on orders of $50 or more.</p>
        </aside>
      </div>
    </div>
  );
}
