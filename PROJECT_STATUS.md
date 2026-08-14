# Project Status

Last Updated: 2026-08-14
Current Phase: Phase 2 — Database Foundation (not started)
Current Task: Design the core data model (User, Account, Category, Transaction, Budget, Bill/BillOccurrence, SavingsGoal/GoalContribution) as a Prisma schema, per ADR-002/ADR-003/ADR-005

## Completed

### Phase 0 — Product and Architecture

- Reviewed `docs/budget-terry-v2-plan-updated.md` end to end.
- Tagged the existing vanilla-JS V1 app as `v1-vanilla-js` (local tag) before starting the V2 rewrite, so it can be recovered.
- Resolved 8 open architecture decisions and wrote them up as ADR-001 through ADR-009 under `docs/adr/` (see `AGENTS.md` §2 for the quick-reference summary):
  - ADR-001 Backend Language and Framework — NestJS + TypeScript
  - ADR-002 Database Engine and Money Representation — PostgreSQL, integer minor units
  - ADR-003 Authentication Strategy for MVP — single-user, auth-ready schema
  - ADR-004 Monorepo Structure and Tooling — pnpm workspaces, no Turborepo yet
  - ADR-005 Transaction Model — Bills and Goals as Linked Transactions
  - ADR-006 Budget Period Model — configurable, payday-anchored
  - ADR-007 Write Idempotency and Split Allocation
  - ADR-008 Category and Account Lifecycle — Archive vs Hard Delete
  - ADR-009 Hosting and Deployment Strategy — Vercel + Render + Neon, local Docker for dev
- Created `AGENTS.md` (canonical agent instructions) and `CLAUDE.md` (pointer to it).

### Phase 1 — Repository Bootstrap

- Relocated the V1 static app to `legacy/v1/` (via `git mv`, history preserved) and repointed `.github/workflows/static.yml` so the live GitHub Pages deployment is unaffected.
- Created the monorepo: pnpm workspaces (`pnpm-workspace.yaml`), root `package.json` with the quality-gate scripts, `.gitignore`, `.nvmrc`, `.npmrc` (`node-linker=hoisted` — required for React Native/Jest to work under pnpm's default nested `node_modules` layout).
- Shared config: `tsconfig.base.json`, `eslint.config.base.mjs` (flat config, typescript-eslint + Prettier integration), `.prettierrc.json`.
- Scaffolded `packages/types`, `packages/validation`, `packages/api-client`, `packages/ui` — each with real starter content (a `Money`/`MinorUnits` type, a Zod `moneySchema`, an `ApiClient` with `Idempotency-Key` support, and a placeholder noting `packages/ui` is reserved for future design-token work), tests, and build/lint/typecheck scripts.
- Scaffolded `apps/api` (NestJS): health endpoint, Prisma wired to PostgreSQL with the schema/generator configured but **no domain models yet** (that's Phase 2's job) — see `apps/api/prisma/schema.prisma`.
- Scaffolded `apps/web` (Next.js 14 App Router + TypeScript + Tailwind CSS 3): minimal home page, Vitest + React Testing Library.
- Scaffolded `apps/mobile` (Expo 52 + expo-router + TypeScript): minimal home screen, Jest (`jest-expo` preset) + React Native Testing Library, monorepo-aware `metro.config.js`. Deliberately has **no `build` script** — Expo doesn't have a meaningful local production build; that's `expo export`/EAS, to be wired when that phase is reached.
- Added `docker-compose.yml` (local Postgres 16, matches `apps/api/.env.example`'s `DATABASE_URL`) and `.env.example` files at root and per-app.
- Added `.github/workflows/ci.yml` (separate from the existing V1 `static.yml`): install → format-check → lint → typecheck → unit tests → integration tests → build, on push/PR to `main`.
- Rewrote root `README.md` per the plan's required sections (Section 27).
- **Verified `pnpm quality` passes end to end on the skeleton** (exit code 0): format:check, lint, typecheck, test (all 7 workspace projects with tests — 10 test files, all green), test:integration (no-op, nothing to run yet), build (all apps/packages that define a build step).
- Verified `docker-compose.yml` is syntactically valid (`docker compose config`); could not start the container in this session because Docker Desktop's daemon wasn't running locally — needs a manual `docker compose up -d` check once Docker Desktop is started.

## In Progress

- None.

## Next Task

Begin **Phase 2 — Database Foundation**:

1. Design the Prisma schema for: `User` (seeded system user per ADR-003), `Account`, `Category`, `Transaction` (with `relatedBillOccurrenceId`/`relatedGoalContributionId` per ADR-005), `Budget`/`BudgetCategory` (with `period`/`anchorDate` per ADR-006), `Bill`/`BillOccurrence`, `SavingsGoal`/`GoalContribution`. Every table gets a required `userId` (ADR-003). Money fields are integer minor units + currency (ADR-002).
2. Add `isArchived` (or equivalent) support to `Category` and `Account` per ADR-008, with hard-delete permitted only when zero transactions reference the row.
3. Write and run the first Prisma migration against local Docker Postgres.
4. Seed default categories (plan Section 89/135 examples).
5. Set up Testcontainers-based integration test scaffolding for `apps/api` (first real use of the `test:integration` script).

Exit criteria (plan Section 60): migrations run cleanly from an empty PostgreSQL instance, integration tests can create/drop isolated test data, database documentation is complete.

## Known Issues

- Docker Desktop wasn't running during this session, so the local Postgres container was configured and validated (`docker compose config`) but not actually started/connected-to. Run `docker compose up -d` and confirm `docker compose ps` shows it healthy before starting Phase 2 migration work.
- A few Section 69 review questions remain informally open (NZD-only for V2? multiple financial accounts in MVP? household budgeting postponed confirmed?) — minor/confirmatory, not architecturally blocking, but worth closing out before or during Phase 2 schema design since they affect `Account`/currency fields.
- `apps/mobile` peer-dependency warning: `jest-expo`'s `react-server-dom-webpack` wants a React 19 RC while the app pins React 18.3.1 (matching the rest of the SDK 52 toolchain). Harmless for component tests observed so far; worth rechecking after any Expo SDK upgrade.

## Decisions Made

See `AGENTS.md` §2 for the quick-reference summary, and `docs/adr/ADR-001` through `ADR-009` for full rationale on each.

## Commands Verified

```bash
pnpm install
pnpm --filter @budget-terry/api run db:generate
pnpm format / pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm quality        # PASS, exit code 0
docker compose config  # valid; daemon not running this session, not started
```

## Last Quality Gate

PASS (2026-08-14) — `pnpm quality` exit code 0 on the Phase 1 skeleton.

## Resume Instructions

1. Read `docs/budget-terry-v2-plan-updated.md`.
2. Read this file (`PROJECT_STATUS.md`).
3. Read `AGENTS.md`.
4. Read `docs/adr/ADR-001` through `ADR-009`, especially ADR-002, ADR-003, ADR-005, ADR-006, ADR-008 (directly shape the Phase 2 schema).
5. Run `git status`.
6. Confirm Docker Desktop is running, then `docker compose up -d` and `docker compose ps` to verify Postgres is healthy.
7. Continue with the task listed under **Next Task** above.
