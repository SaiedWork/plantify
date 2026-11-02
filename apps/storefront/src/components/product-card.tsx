import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@plantify/contracts";
import { QuickAddButton } from "@/components/quick-add-button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";

export function ProductCard({ product }: { product: ProductListItem }) {
  const from = product.minPriceCents !== product.maxPriceCents;
  return (
    // Grid cells stretch to the tallest card in the row; the link takes the spare height so the buttons line up at the bottom.
    <div className="flex h-full flex-col">
      <Link href={`/products/${product.slug}`} className="group block flex-1 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/5">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none",
                !product.inStock && "opacity-60 grayscale-[40%]",
              )}
            />
          ) : null}
          {!product.inStock && (
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium shadow-sm">
              Sold out
            </span>
          )}
        </div>
        <div className="mt-2.5 space-y-0.5">
          <p className="text-xs text-muted-foreground">{product.category.name}</p>
          <h3 className="font-medium leading-tight group-hover:underline">{product.name}</h3>
          <p className="text-sm font-medium">
            {from && <span className="font-normal text-muted-foreground">From </span>}
            {formatPrice(product.minPriceCents)}
          </p>
        </div>
      </Link>
      <QuickAddButton product={product} />
    </div>
  );
}

/** Placeholder that matches the card's proportions, so the page does not jump when products arrive. */
export function ProductGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div aria-hidden className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2.5">
          <div className="aspect-square animate-pulse rounded-xl bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
