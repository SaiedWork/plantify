import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VariantPicker } from "@/components/variant-picker";
import { getProduct, NotFoundError } from "@/lib/api";

async function Product({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {product.images[0] && (
          <Image src={product.images[0].url} alt={product.images[0].alt || product.name} fill unoptimized priority className="object-cover" />
        )}
      </div>
      <div className="space-y-5">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/shop" className="hover:underline">
            Shop
          </Link>{" "}
          /{" "}
          <Link href={`/shop?category=${product.category.slug}`} className="hover:underline">
            {product.category.name}
          </Link>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
        <p className="text-muted-foreground">{product.description}</p>
        <VariantPicker variants={product.variants} productName={product.name} />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
        <Product params={params} />
      </Suspense>
    </div>
  );
}
