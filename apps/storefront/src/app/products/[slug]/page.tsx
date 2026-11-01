import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/product-gallery";
import { VariantPicker } from "@/components/variant-picker";
import { getProduct, NotFoundError } from "@/lib/api";

async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <ProductGallery images={product.images} name={product.name} />
      <div className="space-y-5 md:pt-2">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/shop" className="hover:text-foreground hover:underline">
                Shop
              </Link>
            </li>
            <ChevronRight aria-hidden className="size-3.5" />
            <li>
              <Link href={`/shop?category=${product.category.slug}`} className="hover:text-foreground hover:underline">
                {product.category.name}
              </Link>
            </li>
            <ChevronRight aria-hidden className="size-3.5" />
            <li aria-current="page" className="font-medium text-foreground">
              {product.name}
            </li>
          </ol>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
        <p className="leading-relaxed text-muted-foreground">{product.description}</p>
        <VariantPicker variants={product.variants} productName={product.name} />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense
        fallback={
          <div aria-hidden className="grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
            <div className="space-y-4">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        }
      >
        <Product params={params} />
      </Suspense>
    </div>
  );
}
