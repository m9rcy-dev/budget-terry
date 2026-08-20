# Budget Terry V2

A personal budgeting platform for Web, iOS, and Android — accounts, transactions, budgets, bills, a calendar, and savings goals, backed by one shared domain model.

The full product and engineering plan lives at [`docs/budget-terry-v2-plan-updated.md`](docs/budget-terry-v2-plan-updated.md). Architectural decisions are recorded as ADRs under [`docs/adr/`](docs/adr/). Current project state lives in [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — read that before resuming work. Agent/developer working conventions live in [`AGENTS.md`](AGENTS.md).

> The original vanilla-JS V1 app now lives in [`legacy/v1/`](legacy/v1/) and continues to deploy to GitHub Pages independently of this rewrite (see `.github/workflows/static.yml`).

## Architecture Summary

```text
apps/web      Next.js (App Router) + TypeScript + Tailwind      → Vercel
apps/mobile   Expo + React Native + TypeScript                  → EAS Build/Submit
apps/api      NestJS + TypeScript + Prisma                      → Render
packages/     types, validation, api-client, ui — shared code between the above

Database: PostgreSQL (Neon in production, Docker locally) — see ADR-002, ADR-009
```

Web, mobile, and the API all speak REST/JSON and share request/response contracts via `packages/types` and `packages/validation`, rather than each redefining them.

## Prerequisites

- Node.js (version pinned in [`.nvmrc`](.nvmrc))
- [pnpm](https://pnpm.io/) — `corepack enable` or `npm install -g pnpm`
- [Docker](https://www.docker.com/) (for local Postgres)
- Expo Go app or a simulator, if working on `apps/mobile`

## Repository Structure

```text
apps/
  web/        Next.js web app
  mobile/     Expo mobile app
  api/        NestJS API
packages/
  types/          Shared TypeScript types
  validation/     Shared Zod schemas
  api-client/     Typed HTTP client used by web + mobile
  ui/             Shared presentation primitives / design tokens (minimal for now)
docs/
  budget-terry-v2-plan-updated.md   Product & engineering plan
  adr/                              Architecture decision records
legacy/v1/    Original static V1 app (still deployed via GitHub Pages)
```

## Quick Start — Run the App Locally

There's no single `pnpm dev` yet (see note below) — the API and web app run as two separate processes, each in its own terminal.

1. **Install and configure.**

   ```bash
   git clone <repo-url>
   cd budget-terry
   pnpm install
   cp apps/api/.env.example apps/api/.env
   ```

   The defaults in `apps/api/.env.example` work as-is for local dev — no edits needed to get started.

2. **Start local Postgres.**

   ```bash
   docker compose up -d
   ```

3. **Run migrations and seed a dev account.**

   ```bash
   pnpm db:migrate
   pnpm --filter @budget-terry/api run db:seed
   ```

   This creates a ready-to-use login:

   | Field    | Value                        |
   | -------- | ---------------------------- |
   | Email    | `dev@budgetterry.local`      |
   | Password | `dev-password-please-change` |

4. **Start the API** (terminal 1):

   ```bash
   pnpm --filter @budget-terry/api run start:dev
   ```

   Wait for `Nest application successfully started`, then confirm it's up:

   ```bash
   curl http://localhost:3001/health   # {"status":"ok"}
   ```

5. **Start the web app** (terminal 2):

   ```bash
   pnpm --filter @budget-terry/web run dev
   ```

6. **Open [http://localhost:3000/login](http://localhost:3000/login)** and log in with the seeded credentials above, or register a new account.

`pnpm dev` is not yet wired to a single command across all three apps — for now, run each app individually. This will be revisited once there's enough running concurrently to be worth it.

## Environment Configuration

Copy `.env.example` → `.env` at the root and inside `apps/api/`, `apps/web/`, and `apps/mobile/` as needed. Local development always points at the Dockerized Postgres started by `docker compose up -d` — never at the hosted Neon instance (see ADR-009). Never commit `.env` files or real secrets.

`apps/api`'s `WEB_ORIGIN` (default `http://localhost:3000`) controls CORS — the API only accepts browser requests from this origin. If you run the web app on a different port, update `WEB_ORIGIN` to match or the browser will silently block every request to the API.

## Database Setup

```bash
docker compose up -d          # starts local Postgres
pnpm db:migrate                # runs Prisma migrations against it
```

The Prisma schema lives at `apps/api/prisma/schema.prisma`. Domain models are introduced starting Phase 2 — see `PROJECT_STATUS.md` for current phase.

## Running Each App

```bash
pnpm --filter @budget-terry/api run start:dev     # API on http://localhost:3001
pnpm --filter @budget-terry/web run dev           # Web on http://localhost:3000
pnpm --filter @budget-terry/mobile run start      # Expo dev server (scan QR / press i / a)
```

## Tests

```bash
pnpm test               # unit tests across every app/package
pnpm test:integration   # integration tests (Testcontainers-backed, added from Phase 2 onward)
```

## Lint, Format, Type Checking

```bash
pnpm lint
pnpm format          # writes formatting fixes
pnpm format:check    # verifies formatting without writing
pnpm typecheck
```

## Full Quality Gate

```bash
pnpm quality
# = format:check && lint && typecheck && test && test:integration && build
```

This must pass before any task is considered done — see `AGENTS.md` §7 (Definition of Done).

## Database Migrations

```bash
pnpm db:migrate   # create + apply a new migration in development (apps/api)
```

Migrations live under `apps/api/prisma/migrations/`. Deployment applies migrations via `prisma migrate deploy` rather than `migrate dev`.

## Troubleshooting

- **`pnpm install` can't resolve a workspace package** — make sure you're running commands from the repo root, and that `pnpm-workspace.yaml` covers the package's path (`apps/*`, `packages/*`).
- **API can't reach Postgres** — confirm `docker compose up -d` is running (`docker compose ps`) and that `apps/api/.env`'s `DATABASE_URL` matches `docker-compose.yml`'s credentials.
- **Mobile can't resolve a `@budget-terry/*` package** — this is a pnpm + Metro monorepo issue; `apps/mobile/metro.config.js` handles it, but if you hit a fresh resolution error, clear the Metro cache: `pnpm --filter @budget-terry/mobile exec expo start --clear`.
- **Web login/register always fails, even with correct credentials** — this is almost always the web app unable to reach the API, not a real credentials problem. Check: (1) is `apps/api` actually running (`curl http://localhost:3001/health`)? (2) does `apps/api`'s `WEB_ORIGIN` match the URL the web app is actually served from? A mismatch causes the browser to silently block the request — curl still works fine against the API directly, which is what makes this confusing to diagnose.

## Contributing

Follow the conventions in `AGENTS.md` — read `PROJECT_STATUS.md` before starting, work on one focused task/branch at a time (`feature/BUD-xxx-description`), use conventional commits, and update `PROJECT_STATUS.md` before finishing a session.
