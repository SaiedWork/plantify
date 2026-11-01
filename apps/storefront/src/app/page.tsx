import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Leaf, ShieldCheck, Truck } from "lucide-react";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@plantify/contracts";
import { ProductCard, ProductGridSkeleton } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { getCategories, getProducts } from "@/lib/api";
import { formatPrice } from "@/lib/format";

async function Categories() {
  const categories = await getCategories();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((c) => (
        <li key={c.id}>
          <Link
            href={`/shop?category=${c.slug}`}
            className="group flex h-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-green-700/50 hover:bg-muted"
          >
            <span>
              <span className="block font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">
                {c.productCount} {c.productCount === 1 ? "plant" : "plants"}
              </span>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Featured() {
  // Four fills one row of the grid; more would leave an orphan on a second row.
  const { items } = await getProducts({ featured: true, pageSize: 4, sort: "name" });
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

const PERKS = [
  { icon: Truck, title: `Free shipping over ${formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)}`, text: "Flat-rate delivery on smaller orders." },
  { icon: Leaf, title: "Healthy, hand-picked plants", text: "Every plant is checked before it leaves the greenhouse." },
  { icon: ShieldCheck, title: "A safe demo", text: "Fake data and fake payments, so try anything." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-8 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-800 to-green-950 px-6 py-14 text-green-50 sm:px-10 sm:py-20">
        <Leaf aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-72 rotate-12 text-white/5 sm:size-96" />
        <div className="relative">
          <p className="text-sm font-medium uppercase tracking-widest text-green-300">Plants for every corner</p>
          <h1 className="mt-3 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">Bring a little green home.</h1>
          <p className="mt-4 max-w-lg text-green-100">
            Houseplants, succulents, herbs and everything to keep them thriving.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/shop" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Shop all plants <ArrowRight aria-hidden />
            </Link>
            <Link
              href="/shop?inStock=true&sort=newest"
              className={buttonVariants({ size: "lg", variant: "ghost" }) + " text-green-50 hover:bg-white/10 hover:text-white"}
            >
              See what&apos;s new
            </Link>
          </div>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-3">
        {PERKS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">{title}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Browse by category</h2>
        <Suspense fallback={<div className="h-16 animate-pulse rounded-xl bg-muted" />}>
          <Categories />
        </Suspense>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Customer favourites</h2>
          <Link href="/shop" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            View all
          </Link>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <Featured />
        </Suspense>
      </section>
    </div>
  );
}
