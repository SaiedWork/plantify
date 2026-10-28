const STOREFRONT = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://storefront.localhost:3000";

/** Bundled product images live in the storefront's /public; uploads are served through this app's /api proxy. */
export const imageSrc = (url: string) => (url.startsWith("/products/") ? `${STOREFRONT}${url}` : url);
