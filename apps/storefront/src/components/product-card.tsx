import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@plantify/contracts";
import { formatPrice } from "@/lib/format";

export function ProductCard({ product }: { product: ProductListItem }) {
  const from = product.minPriceCents !== product.maxPriceCents;
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : null}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
            Sold out
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-xs text-muted-foreground">{product.category.name}</p>
        <h3 className="font-medium leading-tight group-hover:underline">{product.name}</h3>
        <p className="text-sm">
          {from && <span className="text-muted-foreground">From </span>}
          {formatPrice(product.minPriceCents)}
        </p>
      </div>
    </Link>
  );
}
