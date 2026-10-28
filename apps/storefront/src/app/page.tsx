import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getProducts } from "@/lib/api";

async function Categories() {
  const categories = await getCategories();
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/shop?category=${c.slug}`}
          className="rounded-full border px-4 py-1.5 text-sm hover:bg-muted"
        >
          {c.name} <span className="text-muted-foreground">({c.productCount})</span>
        </Link>
      ))}
    </div>
  );
}

async function Featured() {
  const { items } = await getProducts({ featured: true, pageSize: 8, sort: "name" });
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
      <section className="rounded-2xl bg-green-900 px-8 py-14 text-green-50">
        <h1 className="text-4xl font-bold tracking-tight">Bring a little green home.</h1>
        <p className="mt-3 max-w-lg text-green-100">
          Houseplants, succulents, herbs and everything to keep them thriving.
        </p>
        <Link href="/shop" className={buttonVariants({ size: "lg", variant: "secondary" }) + " mt-6"}>
          Shop all plants
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Browse by category</h2>
        <Suspense fallback={<div className="h-9" />}>
          <Categories />
        </Suspense>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Customer favourites</h2>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <Featured />
        </Suspense>
      </section>
    </div>
  );
}
