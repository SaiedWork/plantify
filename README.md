# Plantify

A demo online plant store with an admin/ERP dashboard and a NestJS API, in one pnpm + Turborepo monorepo. Everything is fake: no real payments or email, and the database is meant to be wiped periodically.

## What it shows

- **Storefront:** catalog with search and filters, cart, checkout with a fake card, sign-up with a 6-digit code read from an in-app demo inbox, order history, invoices and addresses.
- **Admin / ERP:** products and variants with image uploads, inventory ledger, orders and refunds, customers, a sales dashboard, signed outbound webhooks, staff roles and an audit log.
- **API:** NestJS REST with Better Auth, role-based guards, a signed mock-payment webhook, rate limits and daily caps, and a 7-day reset.

Want the guided tour? Follow the [five-minute demo script](docs/DEMO.md).

| App | Path | Port |
|---|---|---|
| API (NestJS) | `apps/api` | 4000 |
| Storefront (Next.js) | `apps/storefront` | 3000 |
| Admin (Next.js) | `apps/admin` | 3001 |

Shared code lives in `packages/contracts` (zod schemas, types, roles) and `packages/db` (Drizzle schema, migrations, seed).

## Quick start

Requires Node >= 22, pnpm 9 and Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d      # Postgres :5432, Mailpit SMTP :1025 / UI http://localhost:8025
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open the apps at these hostnames (not plain `localhost`) so the two apps' session cookies do not collide:

- Storefront: http://storefront.localhost:3000
- Admin: http://admin.localhost:3001

Admin demo logins (password `plantify-demo`): `owner@plantify.test`, `catalog@plantify.test`.

OTP codes appear in the in-app demo inbox, and in Mailpit when `SMTP_URL` is set.

Demo cards: `1234 5678 9` pays, `0000 0000 0` is declined, `1111 1111 1` asks for a fake 3-D Secure approval (any future expiry, CVC `123`).

## Common commands

```bash
pnpm dev                 # run all apps
pnpm typecheck
pnpm lint
pnpm test                # unit tests
pnpm build
pnpm db:reset            # wipe and re-seed the database
pnpm --filter @plantify/api test:e2e   # API e2e tests (needs migrated + seeded DB)
pnpm --filter @plantify/db generate    # new Drizzle migration after a schema change
```

## Docs

- [docs/DEMO.md](docs/DEMO.md): five-minute demo script
- [docs/PLAN.md](docs/PLAN.md): project plan and milestone status
- [docs/DEPLOY.md](docs/DEPLOY.md): Vercel + Neon deployment steps and env vars
- [docs/COLLABORATION.md](docs/COLLABORATION.md): how we work (task loop)
- [docs/Plantify-Auth-Journeys.md](docs/Plantify-Auth-Journeys.md): customer auth flows
- [CLAUDE.md](CLAUDE.md): architecture notes and guidance for Claude Code
