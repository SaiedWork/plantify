import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown, SlidersHorizontal, Sprout, X } from "lucide-react";
import { ProductCard, ProductGridSkeleton } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCategories, getProducts } from "@/lib/api";

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SORTS = [
  ["relevance", "Best match"],
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["name", "Name"],
] as const;

const PRICES = [
  { label: "Any price" },
  { label: "Under $15", maxPrice: 1500 },
  { label: "$15 – $30", minPrice: 1500, maxPrice: 3000 },
  { label: "$30 and up", minPrice: 3000 },
];

function href(current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, page: undefined, ...patch })) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

function FilterLink({ active, to, children }: { active: boolean; to: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted font-medium text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

type Current = Record<string, string | undefined>;
type Category = Awaited<ReturnType<typeof getCategories>>[number];

function Filters({ current, categories }: { current: Current; categories: Category[] }) {
  return (
    <div className="space-y-6">
    <div>
      <h2 className="mb-1 text-sm font-semibold">Category</h2>
      <FilterLink active={!current.category} to={href(current, { category: undefined })}>
        All
      </FilterLink>
      {categories.map((c) => (
        <FilterLink key={c.id} active={current.category === c.slug} to={href(current, { category: c.slug })}>
          {c.name}
        </FilterLink>
      ))}
    </div>
    <div>
      <h2 className="mb-1 text-sm font-semibold">Price</h2>
      {PRICES.map((p) => (
        <FilterLink
          key={p.label}
          active={current.minPrice === (p.minPrice?.toString() ?? undefined) && current.maxPrice === (p.maxPrice?.toString() ?? undefined)}
          to={href(current, { minPrice: p.minPrice?.toString(), maxPrice: p.maxPrice?.toString() })}
        >
          {p.label}
        </FilterLink>
      ))}
    </div>
    <div>
      <h2 className="mb-1 text-sm font-semibold">Availability</h2>
      <FilterLink
        active={current.inStock === "true"}
        to={href(current, { inStock: current.inStock === "true" ? undefined : "true" })}
      >
        In stock only
      </FilterLink>
    </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  const current = {
    q: first(raw.q)?.slice(0, 80),
    category: first(raw.category),
    sort: first(raw.sort),
    minPrice: first(raw.minPrice),
    maxPrice: first(raw.maxPrice),
    inStock: first(raw.inStock),
  };
  const page = Math.max(1, Number(first(raw.page)) || 1);

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ ...current, inStock: current.inStock === "true" ? true : undefined, page, pageSize: 12 }),
  ]);
  const pages = Math.max(1, Math.ceil(products.total / products.pageSize));
  const priceLabel = PRICES.find(
    (p) => p.minPrice?.toString() === current.minPrice && p.maxPrice?.toString() === current.maxPrice && (p.minPrice || p.maxPrice),
  )?.label;
  const chips = [
    current.q && { label: `“${current.q}”`, clear: { q: undefined } },
    current.category && { label: categories.find((c) => c.slug === current.category)?.name ?? current.category, clear: { category: undefined } },
    priceLabel && { label: priceLabel, clear: { minPrice: undefined, maxPrice: undefined } },
    current.inStock === "true" && { label: "In stock", clear: { inStock: undefined } },
  ].filter((c) => !!c);
  const activeCount = chips.length;

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr] md:gap-10">
      <aside className="hidden md:block">
        <Filters current={current} categories={categories} />
      </aside>
      <details className="group rounded-xl border bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden className="size-4" /> Filters
            {activeCount > 0 && (
              <span className="rounded-full bg-green-700 px-1.5 text-xs text-white dark:bg-green-600">{activeCount}</span>
            )}
          </span>
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-4">
          <Filters current={current} categories={categories} />
        </div>
      </details>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {products.total} {products.total === 1 ? "product" : "products"}
            {current.q ? ` for “${current.q}”` : ""}
          </p>
          <div className="flex flex-wrap gap-1 text-sm">
            {SORTS.filter(([value]) => value !== "relevance" || current.q).map(([value, label]) => (
              <Link
                key={value}
                href={href(current, { sort: value })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs hover:bg-muted",
                  (current.sort ?? (current.q ? "relevance" : "name")) === value && "border-green-700 bg-green-50 font-medium text-green-900 dark:border-green-500 dark:bg-green-950 dark:text-green-200",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <Link
                key={c.label}
                href={href(current, c.clear)}
                aria-label={`Remove filter ${c.label}`}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/70"
              >
                {c.label} <X aria-hidden className="size-3" />
              </Link>
            ))}
            <Link href="/shop" className="px-1 text-xs text-muted-foreground underline hover:text-foreground">
              Clear all
            </Link>
          </div>
        )}

        {products.items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <Sprout aria-hidden className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No plants match that.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different word or clear a filter.</p>
            <Link href="/shop" className={buttonVariants({ variant: "outline" }) + " mt-4"}>
              Clear all filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-4 text-sm" aria-label="Pagination">
            {page > 1 && (
              <Link className={buttonVariants({ variant: "outline" })} href={href(current, { page: String(page - 1) })}>
                Previous
              </Link>
            )}
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link className={buttonVariants({ variant: "outline" })} href={href(current, { page: String(page + 1) })}>
                Next
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

export default function ShopPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Shop</h1>
      <Suspense fallback={<ProductGridSkeleton count={6} className="lg:grid-cols-3" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
