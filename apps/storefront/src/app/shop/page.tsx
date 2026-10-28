import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
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
      className={cn("block rounded-md px-2 py-1 text-sm hover:bg-muted", active && "bg-muted font-medium")}
    >
      {children}
    </Link>
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

  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <aside className="space-y-6">
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
      </aside>

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
                  "rounded-full border px-3 py-1 hover:bg-muted",
                  (current.sort ?? (current.q ? "relevance" : "name")) === value && "bg-muted font-medium",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {products.items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="font-medium">No plants match that.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different word or clear a filter.</p>
            <Link href="/shop" className="mt-3 inline-block text-sm underline">
              Clear all filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {products.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 pt-4 text-sm" aria-label="Pagination">
            {page > 1 && (
              <Link className="rounded-md border px-3 py-1 hover:bg-muted" href={href(current, { page: String(page - 1) })}>
                Previous
              </Link>
            )}
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link className="rounded-md border px-3 py-1 hover:bg-muted" href={href(current, { page: String(page + 1) })}>
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
      <h1 className="mb-6 text-2xl font-bold">Shop</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
