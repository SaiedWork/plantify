# Deploying Plantify (Vercel + Neon)

Status: **deployed** after the final UX/UI pass (milestone 10 in [PLAN.md](PLAN.md)) and smoke-tested on Vercel and Neon: API `https://plantify-api.vercel.app`, storefront `https://plantify-storefront.vercel.app`, admin `https://admin-plantify.vercel.app`. The pitfalls hit on the first deploy are in section 6.

Three Vercel projects from this one repo, one Neon database, all on free tiers (no card needed).

## 1. Neon

1. Create a project (Postgres 17). Keep the **pooled** URL (`...-pooler...neon.tech`) and the **direct** URL.
2. The simplest route is Vercel's Neon integration (Storage tab): it injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) into a project. Otherwise set them by hand.
3. The runtime driver is chosen from the hostname: `*.neon.tech` uses the Neon serverless (websocket) driver, anything else uses node-postgres.

## 2. Vercel projects

For each project, import the same GitHub repo, keep "Include source files outside of the Root Directory" enabled, and pick the **Root Directory** below. Production branch: `main`.

| Project | Root Directory | Notes |
|---|---|---|
| plantify-api | `apps/api` | `vercel.json` sets everything (no framework preset, install/build commands, rewrite to `api/index.js`, daily cron, 60 s function limit). |
| plantify-storefront | `apps/storefront` | Next.js preset. Install from the repo root is automatic (pnpm workspace). |
| plantify-admin | `apps/admin` | Next.js preset. |

If the Next projects fail on workspace packages, set the build command to `cd ../.. && pnpm exec turbo run build --filter=@plantify/storefront` (or `admin`) and the output directory to `.next`.

**Migrations run in the API project's build step** (`pnpm --filter @plantify/db migrate:deploy`): drizzle applies pending SQL from `packages/db/drizzle` using `DATABASE_URL_UNPOOLED` (falls back to `DATABASE_URL`). It runs on **production deployments only**; previews skip it so they never touch the production database. A failing migration fails the deploy. Generate migrations locally with `pnpm --filter @plantify/db generate` and commit them.

## 3. Environment variables

URLs below assume the default `*.vercel.app` names; substitute your own.

**plantify-api**

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `DATABASE_URL_UNPOOLED` | Neon direct URL (build step only) |
| `BETTER_AUTH_SECRET` | random, 32+ chars |
| `PAYMENT_WEBHOOK_SECRET` | random |
| `CRON_SECRET` | random; Vercel sends it as `Authorization: Bearer` on cron calls |
| `API_URL` | public URL of the API project (Better Auth base URL, mock payment webhook target) |
| `STOREFRONT_URL` / `ADMIN_URL` | public URLs of the two Next projects (trusted origins; `STOREFRONT_URL` is also the base of the order links in emails) |
| `BLOB_READ_WRITE_TOKEN` | from a Vercel Blob store connected to this project |

Leave `SMTP_URL` unset: mail goes to the DB-backed demo inbox. Do not set `AUTH_RATE_LIMIT` or `WEBHOOK_ALLOW_PRIVATE` (e2e-only switches).

**plantify-storefront**: `API_URL` (the API project URL, used by the `/api/*` rewrite).
**plantify-admin**: `API_URL`, and `NEXT_PUBLIC_STOREFRONT_URL` (product image links).

## 4. Manual reset

The cron resets data once `meta.last_reset_at` is 7 days old. To force it: `POST <API_URL>/api/internal/reset?force=1` with `Authorization: Bearer $CRON_SECRET`, or run the "Reset demo data" GitHub workflow (needs a `DATABASE_URL` repository secret set to the Neon direct URL).

## 5. Smoke test

1. Deploy the API first, then the two Next apps; open `<API_URL>/api/health`.
2. Seed the empty database once: `DATABASE_URL=<direct url> pnpm db:seed` (or call the reset endpoint with `force=1`).
3. Storefront: sign up, read the OTP in the demo inbox, add to cart, pay with the demo card, see order and invoice.
4. Admin: sign in as owner, catalog manager and order manager, check permissions, upload a product image (Blob), send a test event to the built-in Plantify Echo endpoint, optionally register your own webhook URL, and confirm delivery.
5. Trigger the reset endpoint and confirm the wipe, reseed, Blob cleanup and banner countdown.

## 6. First-deploy pitfalls

- **Build-time env vars must be declared in `turbo.json`.** Vercel builds the Next apps through Turborepo, whose strict env mode strips undeclared variables. `API_URL` (read by `rewrites()` in `next.config.ts` at build time) and `NEXT_PUBLIC_STOREFRONT_URL` are listed under the `build` task; without that the rewrite fell back to `localhost:4000` and every `/api/*` call returned 404 with `x-vercel-error: DNS_HOSTNAME_RESOLVED_PRIVATE`. Changing these variables needs a redeploy. The "missing from turbo.json" warnings Vercel prints for the API's runtime variables are harmless.
- **Neon integration**: turn **Neon Auth** off (Better Auth is the only auth), leave the custom prefix empty so the variables are named `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, connect Production only, and create a fresh database (the reset truncates every table of the database it points at). Delete any `DATABASE_URL*` variable you imported by hand first; the integration refuses to overwrite existing names.
- **Vercel Blob**: create a **Public** store, connect it to `plantify-api` with an empty prefix and tick "Add a read-write token env var" (the code reads `BLOB_READ_WRITE_TOKEN`). Remove any hand-made `BLOB_READ_WRITE_TOKEN` first, for the same clash reason.
- **Secret variables look empty.** Vercel's Secret type is write-only: the edit box is blank after saving even though the value is stored. Cancel instead of saving blank. Empty values in an imported `.env` file are really empty.
- **Import settings**: pick "Import single project" per app (not Services), set the Root Directory (`apps/api`, `apps/storefront`, `apps/admin`) and, for the API, preset `Other` (it is auto-detected as Vite). Set the Node.js version to 22.x in each project (Settings, Build and Deployment); `engines` is `>=22`, so Vercel otherwise picks the newest.
- **CI**: `pnpm typecheck` runs `next typegen` first in both Next apps, because `LayoutProps` is a generated global type that does not exist on a fresh checkout.
- Scope `DATABASE_URL*` and `CRON_SECRET` to Production so previews never touch the production database.
