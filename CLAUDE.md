# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Plantify is a zero-budget demo store: a Next.js storefront, a Next.js admin/ERP, and a NestJS REST API in one pnpm + Turborepo monorepo (Node >= 22, pnpm 9). All data is fake and the DB is meant to be wiped periodically. All planned features are built and deployed.

## Workflow (mandatory)

All work follows this loop: propose the next task, wait for the dev user's approval, implement, report with a short summary, the proposed next task and a short domain-based commit message, then wait for review. Never skip it, never start a task unapproved, and never commit unless asked.

## Commands

Run from the repo root unless noted. Local services: `docker compose up -d` (Postgres 17 on 5432, Mailpit SMTP 1025 / UI 8025). Copy `.env.example` to `.env` at the root (the db scripts load `../../.env`).

```bash
pnpm dev                 # turbo: all apps (api :4000, storefront :3000, admin :3001)
pnpm typecheck | lint | test | build
pnpm db:migrate | db:seed | db:reset
pnpm --filter @plantify/db generate    # drizzle-kit: new migration after schema change
pnpm --filter @plantify/db images      # regenerate seed product SVGs
```

API tests (in `apps/api`):

```bash
pnpm --filter @plantify/api test                       # unit (vitest, src/**/*.spec.ts)
pnpm --filter @plantify/api test:e2e                   # e2e (test/*.e2e-spec.ts), needs migrated+seeded Postgres
pnpm --filter @plantify/api exec vitest run --config ./vitest.config.e2e.ts test/checkout.e2e-spec.ts   # single e2e file
pnpm --filter @plantify/api exec vitest run -t "name"  # single test by name
```

E2E files share one database and run serially (`fileParallelism: false`). The API lints with oxlint (`--type-aware`); the Next apps use eslint. `packages/contracts` has its own vitest tests; `packages/db` has none. Turbo `build` runs before `dev`/`lint`/`typecheck`/`test` (`dependsOn: ^build`), and `contracts`/`db` compile to `dist`, so rebuild them after editing if an app seems to see stale types.

## Architecture

- `apps/api` (NestJS 12, Express): the only backend. Feature modules per domain (`catalog`, `cart`, `orders`/`checkout`, `payments`, `addresses`, `webhooks`, `mail`, `audit`, `auth`, `admin`). `admin/` serves the admin app (catalog, orders, inventory, customers, dashboard stats, staff, owner-only endpoints). Request bodies are validated with zod via `common/zod-pipe.ts`; schemas come from `@plantify/contracts`. `configure-app.ts` is shared by `main.ts` and the e2e harness (`test/support.ts`). The Nest body parser is disabled because Better Auth and the payment webhook need raw bodies.
- `apps/storefront` (port 3000) and `apps/admin` (port 3001): Next 16 with Turbopack, React 19, Tailwind 4, shadcn (initialised per app; `packages/ui` is an empty stub). Both use `next.config.ts` `rewrites()` to proxy `/api/*` to `API_URL`, so auth cookies are first-party and there is no CORS. `src/proxy.ts` (Next's renamed middleware) is only an optimistic cookie-exists redirect; real authorization always happens in the API. Data fetching uses hand-written helpers in `src/lib/api-client.ts` / `use-api.ts` with response types from `@plantify/contracts` (no generated OpenAPI client).
- `packages/contracts`: shared zod schemas, DTO/response types, the role/permission map (`roles.ts`), pricing, and the mock card magic numbers. Source of truth for both API validation and UI typing.
- `packages/db`: Drizzle schema (`src/schema`), SQL migrations (`drizzle/`), seed (faker), reset script, and the `client.ts` that picks the pg driver locally and the Neon serverless driver in production.
- Auth: a single Better Auth instance lives in the API (`auth/auth.service.ts`, mounted at `/api/auth/*`) with emailOTP and admin/access-control plugins. Nest guards call `auth.api.getSession()`. Roles are `customer`, `catalog_manager`, `order_manager`, `owner` (the three staff accounts are seeded; the owner is fixed and the owner can only swap `catalog_manager` and `order_manager` between those two accounts, so each is always held by exactly one person; there is no grant/revoke); the `role` field is `input: false`. Authorization is enforced by API guards/decorators (`auth/access.ts`); the UI only hides things.
- Guest checkout: orders can have no account (`order.user_id` null, `contact_email` always set). Ownership is `Buyer`/`ownedBy` in `apps/api/src/orders/buyer.ts`: a session user, or the signed `guest_orders` cookie. `@OptionalAuth()` routes fill `req.user` when a session exists. Emailed order links are stateless HMAC tokens with a 24 h expiry (`guest-access.ts`); verified sign-ins attach guest orders by email (`auth.service.ts`).
- Email is faked: `MailService` always writes to the `demo_emails` table and additionally sends via SMTP (Mailpit) when `SMTP_URL` is set. The storefront's "demo inbox" reads those rows, gated by a signed `demo_inbox` cookie (`mail/`) that lists each address with the time it was granted, so a new session never reads older mail left for the same address; a signed-in user always reads their own address. Guest cookies (`plantify_cart`, `guest_orders`, `demo_inbox`) are session cookies that end when the browser closes; only signed-in users get persistent ones, and the storefront keeps its inbox markers in `sessionStorage` for guests and `localStorage` once signed in.
- Payments are fake: `MockPaymentProvider` emits a signed (HMAC) webhook to the API's own `/webhooks/payments`; handling is idempotent by event id and on success marks the order paid, writes a stock ledger row, creates the invoice and fires outbound webhooks (`payments/`, `orders/`).
- Outbound webhooks (`webhooks/`): transactional outbox, HMAC-signed, SSRF-guarded (`ssrf.ts`; e2e sets `WEBHOOK_ALLOW_PRIVATE=1`). The app is deployed on Vercel (three projects) and Neon; production-only paths (Vercel Blob uploads, `waitUntil` delivery, forced reset, Neon) passed the prod smoke test, and the first scheduled cron run is unconfirmed. First-deploy pitfalls (notably declaring build-time env vars in `turbo.json`) are in `docs/DEPLOY.md`.

## Gotchas

- Use `storefront.localhost:3000` and `admin.localhost:3001` in the browser, not `localhost:*`, so the two apps' session cookies do not collide (`STOREFRONT_URL`/`ADMIN_URL` in `.env.example`; the API also trusts `localhost:3000/3001` origins in dev).
- `apps/storefront/AGENTS.md` and `apps/admin/AGENTS.md` warn that this Next.js version has breaking changes (e.g. `cacheComponents`, `proxy.ts`): read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Those blocks are regenerated by `next dev`.
- `apps/api/AGENTS.md` notes production telemetry goes to NestJS Observe, which is not wired up until `ObserveModule` is registered in `src/app.module.ts`.
- `docs/Plantify-Auth-Journeys.md` documents the customer sign-up / sign-in / OTP flows.
- CI (`.github/workflows/ci.yml`) runs `typecheck`, `lint`, `test`, `build` against a Postgres service; note `pnpm test` does not run the API e2e suite.
