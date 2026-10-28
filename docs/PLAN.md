# Plantify – demo online store + admin ERP (monorepo plan)

> This is the plan as approved at the start of the project. The status section below tracks progress and
> any deliberate differences; the rest of the document is left as originally written.

## Status

| Milestone | State |
|---|---|
| 0 Scaffold (monorepo, Docker, CI) | done |
| 1 DB schema, seed, reset script | done |
| 2 Auth (Better Auth, OTP, demo inbox, role guards) | done |
| 3 Catalog and search | done |
| 4 Cart, checkout, mock payment, signed webhook, invoice, receipt | done |
| 5 Customer account (orders, invoice page, addresses, settings) | done |
| 6 Admin core (products, inventory, orders, refunds, customers, uploads) | done |
| 7 Sales dashboard, outbound webhooks, staff and audit log | done |
| 8 Hardening and deploy (7-day reset cron, rate limits and caps, Vercel and Neon) | not started |
| 9 Polish, README, 5-minute demo script | not started |

**Differences from the plan so far**
- shadcn components are initialised per app (storefront, admin) rather than in a shared `packages/ui`; that package is an empty stub.
- No generated OpenAPI client (`packages/api-client`) or Swagger page yet; apps use hand-written fetch helpers with response types shared from `packages/contracts`.
- Seed product images are generated SVG illustrations (`pnpm --filter @plantify/db images`), not WebP files.
- Playwright browser tests are not in the repo yet; API behaviour is covered by Vitest e2e tests (`pnpm --filter @plantify/api test:e2e`).
- The `/internal/reset` endpoint and the reset countdown banner belong to milestone 8 and do not exist yet. Only `pnpm db:reset` works.
- Production paths (Neon driver, Vercel Blob uploads, `waitUntil` webhook delivery, cron) are written but have not been run on Vercel or Neon.

## Context
Build a zero-budget, fake-data demo: a customer storefront ("Plantify"), an internal admin/ERP dashboard, and a NestJS REST API, in one Turborepo. Nothing is real: no payments, no real email, DB wiped every 7 days. Goals: look and behave like a real product (real sign-up with 6-digit OTP, fake-but-realistic billing, roles, webhooks, invoices, sales stats) while staying 100% on free tiers (Vercel Hobby, Neon Free, GitHub).

Required: Next.js, TypeScript, Tailwind, PostgreSQL, NestJS. Everything else in your stack list is kept (shadcn, Drizzle, Better Auth, Mailpit, Docker, Turbo, Vercel, Neon) because each fits the free/demo constraint.

## Key decisions (the non-obvious ones)

### 1. OTP without a real email provider
Real OTP flow, fake mailbox. Better Auth `emailOTP` plugin generates/hashes/expires/rate-limits real 6-digit codes. Only the *delivery* is faked via a `MailService` with a single seam:
- Every outgoing email is **always written to a `demo_emails` table** (to, subject, html, otp, created_at).
- If `SMTP_URL` is set (local dev) it is **also sent via SMTP to Mailpit** (`localhost:1025`, UI `:8025`).
- Production has no SMTP, so the storefront shows a **"Demo inbox" slide-over** (Gmail-like list, polls every 2s). After requesting a code the UI says "We sent a code to your demo inbox" with an *Open demo inbox* button; user reads the 6-digit code there and types it in. Feels like email, costs nothing.
- Safety: inbox reads are limited to addresses requested from this browser (signed short-lived `demo_inbox` cookie set when an OTP/receipt is triggered). Seeded customers' inboxes aren't reachable.
- OTP rules: 6 digits, 10 min expiry, 5 attempts, 30 s resend cooldown, stored hashed.
- Same inbox also shows order confirmations and invoice emails.
- Future swap: a Resend transport implementing the same interface (free tier can only mail verified recipients, so not used now).

### 2. Auth architecture (Better Auth inside NestJS)
- One Better Auth instance mounted in `apps/api` at `/api/auth/*` (Drizzle adapter, plugins: `emailOTP`, `admin`/access-control). Nest guards call `auth.api.getSession()`, which is the single source of truth.
- **Cookie problem solved with proxying**: `*.vercel.app` is on the public-suffix list, so cookies can't be shared across the three Vercel projects. Both Next apps use `rewrites()` to proxy `/api/*` to the API, so cookies are first-party to each app and no CORS is needed.
- **Local dev gotcha**: `localhost:3000` and `:3001` share cookies. Use `storefront.localhost:3000` and `admin.localhost:3001` (browsers resolve `*.localhost`) so sessions don't collide.
- Customers: sign up (name, email, password) -> OTP verification; sign in with password **or** "email me a code".
- Staff: seeded only; admin sign-in is password-based, with "Demo login as Owner / Catalog manager" buttons. Public sign-up disabled on admin; `role` is `input: false` so nobody can self-assign a role.

### 3. Roles & permissions (3 layers: Nest guard = source of truth, Next middleware redirect, UI hides)
| Area | customer | catalog_manager | owner |
|---|---|---|---|
| Storefront, own account/orders | yes | n/a | n/a |
| Products, categories, inventory | – | full | full |
| Orders (view, fulfil/ship) | – | view + fulfil | full (+ cancel/refund) |
| Customers overview | – | – | view |
| Sales dashboard (revenue) | – | stock/low-stock widgets only | full |
| Invoices, payments, billing settings | – | – | full |
| Webhooks, staff/roles, audit log, reset info | – | – | full |

Implementation: `@Roles()` / `@RequirePermission('orders:refund')` decorators + `RolesGuard`; permission map in `packages/contracts` shared with the UI.

### 4. Fake billing
- `PaymentProvider` interface with a `MockPaymentProvider` ("Plantify Pay"). No card data stored: only brand + last4 + status.
- Checkout shows a hint box with an **"Autofill demo card"** button. Magic numbers in one constant file:
  - `1234 5678 9` (your simple number), CVC `123`, any future expiry -> **success**
  - `0000 0000 0` -> **declined**
  - `1111 1111 1` -> **needs "3-D Secure"** step (fake modal) -> success
  - Anything else -> "Use a demo card" validation message.
- Flow: order `pending_payment` -> payment attempt -> provider emits a **signed `payment.succeeded|failed` webhook to our own `/webhooks/payments`** (HMAC, raw body verification, idempotent by event id) -> order `paid`, stock decremented (ledger row), invoice created (`PLT-2026-0001`), receipt email to demo inbox, outbound webhooks fired.
- Invoices: DB record + printable HTML page (`/invoices/:id`, print stylesheet, "Download PDF" via browser print; `@react-pdf/renderer` as optional upgrade). Customer sees them in order history, owner in admin.
- Fake refunds (owner) restock optionally and create a credit note.

### 5. Webhooks (demonstrated both ways)
- Inbound: payment webhook above, with a delivery log.
- Outbound: owner registers endpoint URLs (e.g. webhook.site) for `order.created|paid|shipped|refunded`, `inventory.low`. Transactional **outbox** table, HMAC-SHA256 signature header, first attempt fired inline (`waitUntil`), retries via manual "Resend" button + daily cron (Hobby cron is once/day max, so no minute-level retry worker). Delivery log UI in admin. SSRF guard: block private/loopback IPs.

### 6. API hosting (NestJS on free tier)
Deploy `apps/api` as its own **Vercel project** (Nest on Vercel serverless; if zero-config support is awkward, thin `api/index.ts` wrapping the Express adapter and cached app instance). Avoids sleeping free hosts. Caveats handled: no in-memory state (rate limits stored in DB), no background threads (outbox + cron), keep cold start small.

### 7. Database (Neon + Drizzle)
- Local: Docker Postgres. Prod: Neon pooled connection string via `@neondatabase/serverless` driver; `drizzle-kit migrate` uses the direct URL (CI/deploy step). Driver chosen by env in `packages/db`.
- Money = integer cents + currency. IDs = uuid v7/text. Timestamps `timestamptz`.
- Search: generated `tsvector` column + GIN index, plus `pg_trgm` for typo tolerance; filters (category, price, in-stock), sort, pagination, cursor or offset.
- **7-day reset**: `meta.last_reset_at` row. Vercel Cron (daily) calls `POST /internal/reset` (protected by `CRON_SECRET`); if >= 7 days old -> truncate all tables in one transaction and reseed. Also a manual GitHub Actions `workflow_dispatch` that runs `pnpm db:reset`. UI footer/banner: "Demo data resets in N days" (reads `meta`). Seed dates are relative to reset time so charts always look fresh.

### 8. Abuse/cost protection (public demo, no budget)
Noindex + "demo, don't enter real data" banner; DB-backed rate limits (auth, OTP, checkout); caps (e.g. max N new users/orders per day, max cart size, field length limits); uploads limited to staff, small, typed, and wiped on reset (see 9); `.test`/`example.com` fake addresses; Neon auto-suspend is fine (cold start ~0.5 s).

### 9. Object storage (product images)
Two tiers, so the demo never depends on storage for its core experience:
- **Seed images (the ~40 catalog products): no object storage.** Optimized WebP files are committed in `packages/db/seed-assets/` and copied to the storefront `public/products/` at build. Served by Vercel's CDN through `next/image`. They survive the 7-day reset because they live in the repo, not in a bucket.
- **Admin uploads (new/edited products): Vercel Blob** (Hobby plan, free, no card, same Vercel account, so no extra service). Behind a `StorageProvider` interface in `apps/api`:
  - `LocalDiskProvider` for dev (writes to `./.uploads`, served by the API at `/uploads/*`; no extra Docker container). A MinIO container is the alternative if you want an S3-API demo, but it adds weight for little gain.
  - `VercelBlobProvider` for prod.
  - Flow: admin requests a signed upload from the API (role-checked: owner or catalog_manager) -> browser uploads directly to Blob (bypasses the 4.5 MB serverless body limit) -> API stores the returned URL in `product_image`.
  - Limits: JPEG/PNG/WebP only, <= 1 MB (client-side resize before upload), max 5 images per product, magic-byte check server-side, random object keys under `uploads/`.
  - **Reset**: the 7-day reset also lists and deletes everything under `uploads/`, so storage never fills up. Rows that referenced them are wiped anyway.
  - `next.config` `remotePatterns` allows the Blob host.
- Fallback if Blob limits change or are awkward: Cloudflare R2 behind the same interface (S3 API; free tier is bigger but may ask for a card), or drop uploads and keep only the preset gallery. Verify current Blob free-tier limits at implementation time.
- Milestone: added to milestone 6 (admin products).

## Repo layout (pnpm workspaces + Turborepo)
```
plantify/
  apps/
    storefront/   Next.js (App Router) – shop, search, cart, checkout, account, demo inbox
    admin/        Next.js – ERP dashboard
    api/          NestJS – REST, Better Auth mount, webhooks, cron endpoints
  packages/
    db/           Drizzle schema, migrations, seed (faker, fixed seed), reset script, client factory
    contracts/    zod schemas, permission map, order state machine, shared types
    api-client/   typed client generated from Nest OpenAPI (openapi-typescript + openapi-fetch)
    ui/           shared shadcn components + Tailwind v4 theme tokens (Plantify green palette)
    config/       tsconfig, eslint, prettier presets
  docker-compose.yml   postgres + mailpit
  turbo.json, pnpm-workspace.yaml, .env.example
  .github/workflows/   ci.yml, db-reset.yml
  README.md, docs/ (architecture, demo script)
```
Validation: `nestjs-zod` DTOs from `packages/contracts`, Swagger/OpenAPI at `/docs`. Pin latest stable Next.js / Tailwind v4 / shadcn at scaffold time.

## Data model (Drizzle)
- Better Auth: `user` (+ `role`), `session`, `account`, `verification`
- Catalog: `category`, `product`, `product_variant` (sku, price, size/pot), `product_image`
- Inventory: `inventory_level` (per variant), `inventory_movement` ledger (sale/restock/adjustment/return, actor)
- Commerce: `cart`, `cart_item`, `address`, `order`, `order_item` (price/name snapshot), `payment`, `invoice`, `refund`
- Platform: `webhook_endpoint`, `webhook_delivery`, `webhook_event_inbox`, `demo_email`, `audit_log`, `rate_limit`, `meta`
- Order states: `pending_payment -> paid -> processing -> shipped -> delivered`; `cancelled`, `refunded` (transitions enforced in `contracts`).

## Features per app
**Storefront**: home/featured, category pages, product detail w/ variants, search (FTS) with filters/sort, server-side cart (guest cookie, merged on login), checkout (address -> fake card -> confirmation), account (profile, password, addresses, order history + invoice view), sign-up/sign-in with OTP, demo inbox drawer, reset-countdown banner.
**Admin**: login w/ demo buttons; dashboard (revenue, orders, AOV, new customers, sales-over-time chart, top products, orders by status, low-stock list; all SQL `date_trunc` aggregates, shadcn charts); catalogs/products CRUD; inventory (levels, adjust, movement history, low-stock threshold); orders (list, filters, detail, status changes, refund); customers overview (list, LTV, order count); invoices; webhooks (endpoints + delivery log); staff & roles (owner); audit log; settings.

## Milestones (vertical slices, each one deployable)
0. **Scaffold**: monorepo, Docker compose (Postgres + Mailpit), configs, CI skeleton, shared UI package, health endpoint.
1. **DB + seed**: schema, migrations, realistic plant catalog (~40 products, 6 categories), 90 days of fake orders, staff accounts, reset script.
2. **Auth**: Better Auth in Nest, OTP + `MailService` + demo inbox, role guards, both apps' login pages and middleware.
3. **Catalog & search**: products/categories API, storefront browse/search/PDP.
4. **Cart -> checkout -> mock payment -> webhook -> invoice + email + stock ledger.**
5. **Customer account**: settings, addresses, order history, invoices.
6. **Admin core**: products, inventory, orders, customers, invoices.
7. **Dashboard stats** + outbound webhooks UI + staff/audit.
8. **Hardening + deploy**: rate limits, caps, reset cron, three Vercel projects, Neon, env docs, banners/noindex.
9. **Polish**: empty/loading/error states, a11y pass, README + 5-minute demo script.

## Testing
- Vitest unit: pricing/totals, order state machine, magic-card logic, OTP rules, permission map.
- API e2e (supertest) against Docker Postgres: auth + role matrix (each protected endpoint x each role), checkout/webhook idempotency, stock never negative under concurrent checkouts (row-level lock / conditional update).
- Playwright e2e: sign-up -> read OTP in demo inbox -> add to cart -> checkout with demo card -> see order + invoice -> admin owner sees it; catalog_manager is blocked from billing/dashboard revenue; declined card path.
- CI (GitHub Actions): install, lint, typecheck, test (Postgres service), build via Turbo with remote-cache optional.

## Verification (end-to-end, after implementation)
1. `docker compose up -d && pnpm i && pnpm db:migrate && pnpm db:seed && pnpm dev` -> storefront `:3000`, admin `:3001`, API `:4000`, Mailpit `:8025`.
2. Sign up locally: OTP arrives in Mailpit **and** the demo inbox; wrong code x5 locks; resend cooldown works.
3. Buy with the demo card; verify order paid, stock decremented, invoice `PLT-…`, receipt email, webhook delivery logged; declined card leaves order unpaid.
4. Log in to admin as each role; confirm the permission table above (UI hidden *and* direct API calls return 403).
5. Prod smoke test on Vercel/Neon: same flow with no SMTP; trigger `/internal/reset` with `CRON_SECRET` and confirm wipe + reseed + banner countdown.
6. Run `pnpm test` and Playwright suite green in CI.

## Free-tier notes
Vercel Hobby (non-commercial use is fine for a demo; cron max once/day; function time limits), Neon Free (0.5 GB, compute-hours cap, auto-suspend), GitHub Actions free minutes. Nothing here requires a card on file.

## Open items to confirm at kickoff (defaults chosen if no answer)
- Weekly reset cadence enforced by daily cron age check (default) vs. fixed weekly GitHub schedule.
- Magic card numbers as listed above (default) vs. only your single `123456789`.
- Product imagery: seed images bundled in repo (default); admin uploads via Vercel Blob (default) or skip uploads entirely.
