# Plantify

A demo online plant store with an admin/ERP dashboard and a NestJS API, in one pnpm + Turborepo monorepo. Everything is fake: no real payments or email, and the database is meant to be wiped periodically.

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

- [docs/PLAN.md](docs/PLAN.md): project plan and milestone status
- [docs/DEPLOY.md](docs/DEPLOY.md): Vercel + Neon deployment steps and env vars
- [docs/COLLABORATION.md](docs/COLLABORATION.md): how we work (task loop)
- [docs/Plantify-Auth-Journeys.md](docs/Plantify-Auth-Journeys.md): customer auth flows
- [CLAUDE.md](CLAUDE.md): architecture notes and guidance for Claude Code
