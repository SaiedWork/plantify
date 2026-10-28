import "server-only";
import type {
  CategorySummary,
  ProductDetail,
  ProductList,
  ProductListQuery,
} from "@plantify/contracts";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, { cache: "no-store" });
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export class NotFoundError extends Error {}

export const getCategories = () => get<CategorySummary[]>("/categories");

export function getProducts(query: Partial<Record<keyof ProductListQuery, string | number | boolean | undefined>>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return get<ProductList>(`/products?${params}`);
}

export const getProduct = (slug: string) => get<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
