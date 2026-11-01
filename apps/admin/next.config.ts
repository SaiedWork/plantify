import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Admin pages are client components behind a client-side session check, so they can never be
  // "instant"; only validate segments that opt in explicitly (none do).
  experimental: { instantInsights: { validationLevel: "manual-warning" } },
  // Admin uploads live in Vercel Blob (public store hosts look like <id>.public.blob.vercel-storage.com).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Proxy the API so auth cookies are first-party to this app (no CORS, no cross-site cookies).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
