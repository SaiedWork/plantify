import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const PRODUCT_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'name'] as const;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).optional(), // cents
  maxPrice: z.coerce.number().int().min(0).optional(), // cents
  inStock: bool,
  featured: bool,
  sort: z.enum(PRODUCT_SORTS).default('relevance'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
  /** A picture of one of the category's plants (featured first), for the landing page tile. */
  imageUrl: string | null;
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: { slug: string; name: string };
  imageUrl: string | null;
  minPriceCents: number;
  maxPriceCents: number;
  inStock: boolean;
  /** What the quick "Add to cart" on a card adds: the cheapest variant that is in stock (else the cheapest). */
  defaultVariant: { id: string; label: string };
};

export type ProductList = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductVariantDetail = {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  /** Units on hand; the storefront shows "only N left" at or below the low-stock threshold. */
  stock: number;
  lowStockThreshold: number;
};

export type ProductDetail = Omit<ProductListItem, 'imageUrl' | 'minPriceCents' | 'maxPriceCents' | 'inStock' | 'defaultVariant'> & {
  images: { url: string; alt: string }[];
  variants: ProductVariantDetail[];
};
