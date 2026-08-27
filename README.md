# Budget Terry V2

A personal budgeting platform for Web, iOS, and Android — accounts, transactions, budgets, bills, a calendar, and savings goals, backed by one shared domain model.

The full product and engineering plan lives at [`docs/budget-terry-v2-plan-updated.md`](docs/budget-terry-v2-plan-updated.md). Architectural decisions are recorded as ADRs under [`docs/adr/`](docs/adr/). Current project state lives in [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — read that before resuming work. Agent/developer working conventions live in [`AGENTS.md`](AGENTS.md). Deploying to production (Vercel/Render/Neon/Resend/EAS) is covered in [`docs/deployment.md`](docs/deployment.md).

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

## Concepts

- **Accounts** are the only place real money lives — every transaction (income or expense) belongs to exactly one account, and moves that account's balance. Types: `CHEQUE`, `SAVINGS`, `CREDIT_CARD`, `OTHER`.
- **Categories** label what a transaction is for (Groceries, Rent, ...) — independent of which account it happened in.
- **Budgets** are a spending target for a category (or overall) over a period (weekly/fortnightly/monthly), compared against matching transactions. They don't hold money themselves.
- **Bills** forecast recurring outflows (rent, subscriptions) with due dates. Paying one creates a transaction, drawn from either the bill's default account or one chosen at pay-time.
- **Goals** track progress toward a savings target. Contributions are transactions too, drawn from either the goal's default account or one chosen at contribution-time.

New users are walked through creating their first account (mandatory — nothing else works without one) and are then offered an optional, skippable setup for a budget/bills/goal during a one-time onboarding flow.

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

1. **Install and configure.**

   ```bash
   git clone <repo-url>
   cd budget-terry
   pnpm install
   cp apps/api/.env.example apps/api/.env
   ```

   The defaults in `apps/api/.env.example` work as-is for local dev — no edits needed to get started.

2. **Start local Postgres and Mailpit.**

   ```bash
   docker compose up -d
   ```

   Mailpit is a local SMTP catcher — the API sends real SMTP traffic to it instead of a real provider, and you can read caught mail (including login codes) at [http://localhost:8025](http://localhost:8025). No setup needed; `apps/api/.env.example`'s defaults already point at it.

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

4. **Start the API and web app.**

   ```bash
   pnpm dev
   ```

   This starts both in the background (logs at `.dev-logs/api.log` / `.dev-logs/web.log`), clears `apps/web/.next` first (avoids the stale-cache error below), and waits until both respond before returning. Re-running `pnpm dev` at any time stops and restarts both — that's the "one command" for the whole local app. `pnpm dev:stop` / `pnpm dev:start` are also available if you want to stop or start without the other half. See `scripts/dev.sh`.

   Prefer separate terminals (e.g. to watch each app's own log output directly)? Run them individually instead:

   ```bash
   pnpm --filter @budget-terry/api run start:dev     # terminal 1
   pnpm --filter @budget-terry/web run dev           # terminal 2
   ```

5. **Open [http://localhost:3000/login](http://localhost:3000/login)**. Passwordless email code is the default login method: enter `dev@budgetterry.local`, click "Send code", then read the 6-digit code from [Mailpit](http://localhost:8025) (it won't arrive in a real inbox locally). Prefer the password? Click "Log in with password instead" and use the seeded credentials above.

`apps/mobile` isn't included in `pnpm dev` — Expo's own workflow (simulator/device/QR code) doesn't fit the same background-and-poll model; run it separately with `pnpm --filter @budget-terry/mobile run start`.

## Environment Configuration

Copy `.env.example` → `.env` at the root and inside `apps/api/`, `apps/web/`, and `apps/mobile/` as needed. Local development always points at the Dockerized Postgres started by `docker compose up -d` — never at the hosted Neon instance (see ADR-009). Never commit `.env` files or real secrets.

`apps/api`'s `WEB_ORIGIN` (default `http://localhost:3000`) controls CORS — the API only accepts browser requests from this origin. If you run the web app on a different port, update `WEB_ORIGIN` to match or the browser will silently block every request to the API.

`apps/api`'s `MAIL_*`/`SMTP_*`/`RESEND_API_KEY` vars control where login-code emails go. Locally they default to the Mailpit container from `docker-compose.yml` — no changes needed. In production, set `MAIL_PROVIDER=resend` and `RESEND_API_KEY` to send via [Resend](https://resend.com)'s HTTP API — see `src/mail/mail.module.ts` and `docs/architecture/security.md`.

## Database Setup

```bash
docker compose up -d          # starts local Postgres
pnpm db:migrate                # runs Prisma migrations against it
```

The Prisma schema lives at `apps/api/prisma/schema.prisma`. Domain models are introduced starting Phase 2 — see `PROJECT_STATUS.md` for current phase.

## Running Each App

```bash
pnpm dev                                          # API + web together (see Quick Start above)
pnpm --filter @budget-terry/api run start:dev     # API only, on http://localhost:3001
pnpm --filter @budget-terry/web run dev           # Web only, on http://localhost:3000
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
# = build && format:check && lint && typecheck && test && test:integration
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
- **Mobile can't resolve a `@budget-terry/*` package** — Expo (SDK 52+) auto-detects the pnpm workspace root and configures Metro for it; no manual `metro.config.js` needed (a prior manual override existed here and actively caused EAS Build failures via `expo-doctor` — removed). If you hit a fresh resolution error anyway, clear the Metro cache: `pnpm --filter @budget-terry/mobile exec expo start --clear`.
- **Web login/register always fails, even with correct credentials** — this is almost always the web app unable to reach the API, not a real credentials problem. Check: (1) is `apps/api` actually running (`curl http://localhost:3001/health`)? (2) does `apps/api`'s `WEB_ORIGIN` match the URL the web app is actually served from? A mismatch causes the browser to silently block the request — curl still works fine against the API directly, which is what makes this confusing to diagnose.
- **Web dev server shows `Server Error: Cannot find module './NNN.js'`** — a stale/corrupted `apps/web/.next` build cache, usually from the dev server being killed mid-build. `pnpm dev` clears this cache on every start, so it's the easiest fix: `pnpm dev`. Doing it by hand: `rm -rf apps/web/.next && pnpm --filter @budget-terry/web run dev`.
- **Login code never arrives** — locally it's never emailed anywhere real; check [http://localhost:8025](http://localhost:8025) (Mailpit's web UI), not an actual inbox. If nothing shows up there either, confirm the `mailpit` container is running (`docker compose ps`) and that `apps/api`'s `SMTP_HOST`/`SMTP_PORT` still point at `localhost:1025`.

## Contributing

Follow the conventions in `AGENTS.md` — read `PROJECT_STATUS.md` before starting, work on one focused task/branch at a time (`feature/BUD-xxx-description`), use conventional commits, and update `PROJECT_STATUS.md` before finishing a session.
