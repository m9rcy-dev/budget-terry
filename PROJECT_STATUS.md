# Project Status

Last Updated: 2026-08-14
Current Phase: Phase 3 — Authentication (not started)
Current Task: See Next Task below

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
- Scaffolded `apps/api` (NestJS): health endpoint, Prisma wired to PostgreSQL.
- Scaffolded `apps/web` (Next.js 14 App Router + TypeScript + Tailwind CSS 3): minimal home page, Vitest + React Testing Library.
- Scaffolded `apps/mobile` (Expo 52 + expo-router + TypeScript): minimal home screen, Jest (`jest-expo` preset) + React Native Testing Library, monorepo-aware `metro.config.js`. Deliberately has **no `build` script** — Expo doesn't have a meaningful local production build; that's `expo export`/EAS, to be wired when that phase is reached.
- Added `docker-compose.yml` (local Postgres 16) and `.env.example` files at root and per-app.
- Added `.github/workflows/ci.yml` (separate from the existing V1 `static.yml`): install → format-check → lint → typecheck → unit tests → integration tests → build, on push/PR to `main`.
- Rewrote root `README.md` per the plan's required sections (Section 27).
- Verified `pnpm quality` passes end to end on the skeleton.
- Committed locally (not pushed): "Move V1 static app to legacy/v1", "Bootstrap V2 monorepo (Phase 1)".

### Phase 2 — Database Foundation

- Designed and wrote the full Prisma schema (`apps/api/prisma/schema.prisma`): `User`, `Account`, `Category`, `Transaction`, `Budget`/`BudgetCategory`, `Bill`/`BillOccurrence`, `SavingsGoal`/`GoalContribution` — every table carries `userId` (ADR-003), money is integer minor units + currency (ADR-002), Transaction carries the nullable unique `relatedBillOccurrenceId`/`relatedGoalContributionId` links (ADR-005), Budget carries `period`/`anchorDate` (ADR-006), Account/Category carry `isArchived` with `Restrict` FKs as a DB-level safety net (ADR-008).
- Wrote **ADR-010**: bill occurrence status is computed at read time from `dueDate`, not stored as a time-relative enum — only `PENDING`/`PAID`/`SKIPPED` are persisted.
- Added the `(userId, idempotencyKey)` unique constraint on `Transaction` (ADR-007) and `(userId, name)` unique constraint on `Category` (needed for the seed script's upsert to be safely re-runnable).
- Started Docker Desktop and local Postgres (`docker compose up -d`), confirmed healthy.
- Ran the first migrations (`20260814105356_init`, `20260814110000_category_name_unique_per_user`) against local Postgres from an empty database — verified all 10 domain tables + `_prisma_migrations` exist.
- Wrote and ran `apps/api/prisma/seed.ts`: seeds the fixed system user (`SYSTEM_USER_ID` constant, per ADR-003) and the 15 default categories from plan Section 3. Verified idempotent (safe to re-run, no duplicates).
- Set up Testcontainers integration testing for `apps/api`: `test/integration-db.ts` helper (spins up a throwaway Postgres container per test file, applies all migrations, returns a connected `PrismaClient`), `test/jest-integration.config.js`, wired to `pnpm test:integration`.
- Wrote and verified 4 integration tests against a real, freshly-provisioned Postgres container: category/user persistence, the `(userId, name)` category uniqueness constraint, the `(userId, idempotencyKey)` transaction constraint (including that NULLs don't collide), and the `Restrict` delete-protection on `Account` referenced by a `Transaction`. All pass.
- Wrote `docs/architecture/data-model.md` (includes a Mermaid ER diagram) documenting the schema and the reasoning behind each non-obvious decision.
- Verified `pnpm quality` passes end to end, including the new integration tests (exit code 0).

## In Progress

- None.

## Next Task

Begin **Phase 3 — Authentication**. Per the plan's task list and ADR-003 (auth-ready schema, no auth UI in MVP):

1. Register / Login / Logout endpoints, password hashing, session/token management, auth guard, current-user endpoint — but note ADR-003 explicitly defers building these for MVP. Confirm with the user whether Phase 3 should build real auth now or whether to skip straight to Phase 4 (Accounts/Categories) using the seeded system user, and return to real Phase 3 auth later. This is a judgment call the plan leaves open, and the last session's decisions leaned toward deferring auth — worth a quick confirmation before starting.
2. If deferring: build the minimal "current user resolution" mechanism (a NestJS provider/decorator returning `SYSTEM_USER_ID`) that every future authenticated-feeling endpoint will use, so swapping in real auth later only touches that one place.
3. Either way: the critical test from Phase 3 ("user A cannot access user B's data") should be written as soon as any second user can plausibly exist — i.e., deferred alongside real auth, not forgotten.

## Known Issues

- A few Section 69 review questions remain informally open (NZD-only for V2? multiple financial accounts in MVP? household budgeting postponed confirmed?) — minor/confirmatory, not architecturally blocking.
- `apps/mobile` peer-dependency warning: `jest-expo`'s `react-server-dom-webpack` wants a React 19 RC while the app pins React 18.3.1 (matching the rest of the SDK 52 toolchain). Harmless for component tests observed so far; worth rechecking after any Expo SDK upgrade.
- Prisma's `package.json#prisma` seed config is deprecated as of Prisma 6, to be removed in Prisma 7 (currently on 6.19.3) — will need migrating to a `prisma.config.ts` file on the next Prisma major upgrade. Not urgent.
- `Budget`'s "overall cap vs. per-category" invariant (ADR-002-adjacent, see `docs/architecture/data-model.md`) is not enforced by a DB constraint — must be validated at the service layer when the Budget API is built (Phase 7).

## Decisions Made

See `AGENTS.md` §2 for the quick-reference summary, and `docs/adr/ADR-001` through `ADR-010` for full rationale on each.

## Commands Verified

```bash
pnpm install
docker compose up -d                                          # local Postgres, healthy
pnpm --filter @budget-terry/api run db:generate
pnpm --filter @budget-terry/api exec prisma migrate deploy     # 2 migrations applied cleanly
pnpm --filter @budget-terry/api run db:seed                    # idempotent, verified by re-run
pnpm --filter @budget-terry/api run test:integration            # 4/4 pass, real Testcontainers Postgres
pnpm format / pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm quality        # PASS, exit code 0
```

## Last Quality Gate

PASS (2026-08-14) — `pnpm quality` exit code 0, including Phase 2's new integration tests.

## Resume Instructions

1. Read `docs/budget-terry-v2-plan-updated.md`.
2. Read this file (`PROJECT_STATUS.md`).
3. Read `AGENTS.md`.
4. Read `docs/architecture/data-model.md` and `docs/adr/ADR-001` through `ADR-010`.
5. Run `git status`.
6. Confirm Docker Desktop is running, then `docker compose up -d` and `docker compose ps` to verify Postgres is healthy.
7. Continue with the task listed under **Next Task** above — note it starts with a judgment call to confirm with the user, not a straight implementation step.
