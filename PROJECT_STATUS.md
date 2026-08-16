# Project Status

Last Updated: 2026-08-16
Current Phase: Phase 4 — Accounts and Categories (not started)
Current Task: See Next Task below — starts with syncing the local dev database, a prerequisite left over from Phase 3

## Completed

### Phase 0 — Product and Architecture

- Reviewed `docs/budget-terry-v2-plan-updated.md` end to end.
- Tagged the existing vanilla-JS V1 app as `v1-vanilla-js` (local tag) before starting the V2 rewrite, so it can be recovered.
- Resolved 8 open architecture decisions and wrote them up as ADR-001 through ADR-009 under `docs/adr/` (see `AGENTS.md` §2 for the quick-reference summary):
  - ADR-001 Backend Language and Framework — NestJS + TypeScript
  - ADR-002 Database Engine and Money Representation — PostgreSQL, integer minor units
  - ADR-003 Authentication Strategy for MVP — single-user, auth-ready schema (**revised in Phase 3** — see below)
  - ADR-004 Monorepo Structure and Tooling — pnpm workspaces, no Turborepo yet
  - ADR-005 Transaction Model — Bills and Goals as Linked Transactions
  - ADR-006 Budget Period Model — configurable, payday-anchored
  - ADR-007 Write Idempotency and Split Allocation
  - ADR-008 Category and Account Lifecycle — Archive vs Hard Delete
  - ADR-009 Hosting and Deployment Strategy — Vercel + Render + Neon, local Docker for dev
- Created `AGENTS.md` (canonical agent instructions) and `CLAUDE.md` (pointer to it).

### Phase 1 — Repository Bootstrap

- Relocated the V1 static app to `legacy/v1/` (via `git mv`, history preserved) and repointed `.github/workflows/static.yml` so the live GitHub Pages deployment is unaffected.
- Created the monorepo: pnpm workspaces, root `package.json` with the quality-gate scripts, `.gitignore`, `.nvmrc`, `.npmrc` (`node-linker=hoisted` — required for React Native/Jest under pnpm's default nested `node_modules` layout).
- Shared config: `tsconfig.base.json`, `eslint.config.base.mjs`, `.prettierrc.json`.
- Scaffolded `packages/types`, `packages/validation`, `packages/api-client`, `packages/ui`.
- Scaffolded `apps/api` (NestJS + Prisma), `apps/web` (Next.js 14 + Tailwind), `apps/mobile` (Expo 52 + expo-router).
- Docker Compose Postgres, `.env.example` files, CI workflow, rewritten README.
- Verified `pnpm quality` passes end to end on the skeleton.
- Committed locally (not pushed): "Move V1 static app to legacy/v1", "Bootstrap V2 monorepo (Phase 1)".

### Phase 2 — Database Foundation

- Designed and wrote the core Prisma schema: `User`, `Account`, `Category`, `Transaction`, `Budget`/`BudgetCategory`, `Bill`/`BillOccurrence`, `SavingsGoal`/`GoalContribution` — `userId` everywhere (ADR-003), integer minor units + currency (ADR-002), `Transaction`'s linked-record FKs (ADR-005), `Budget.period`/`anchorDate` (ADR-006), `isArchived` + `Restrict` FKs (ADR-008).
- Wrote **ADR-010**: bill occurrence status is computed at read time, not stored as a time-relative enum.
- Ran the first migrations against local Postgres from empty, seeded default categories, set up Testcontainers integration testing, wrote `docs/architecture/data-model.md`.
- Verified `pnpm quality` passes end to end. Committed locally: "Add Phase 2 database foundation".

### Phase 3 — Authentication

Plan Section 60's Phase 3 was originally deferred by ADR-003 (auth-ready schema, no auth UI for MVP). That decision was **reversed mid-session on 2026-08-15** — real authentication is now built, not deferred. ADR-003 was revised in place (with the original decision struck through, not deleted) rather than silently rewritten, so the "why" of the reversal stays visible.

- Wrote **ADR-011** (session/token strategy): JWT access token (15 min, in-memory only, never persisted) + opaque rotating refresh token (30 days, only its SHA-256 hash stored server-side). Bearer transport on both platforms — refresh token in `localStorage` (web) / Expo `SecureStore` (mobile), a deliberate trade-off given ADR-009's cross-origin hosting (documented, not accidental).
- Extended the Prisma schema: `User.passwordHash`, new `RefreshToken` table. Migration `20260815000000_add_auth` — **written by hand** (see Known Issues: the usual `prisma migrate diff`/`reset` tooling was blocked by the harness's safety classifier for touching a live database) and **proven correct** by the integration tests applying it to a fresh Testcontainers Postgres from empty.
- Backend (`apps/api`): `@nestjs/config` + Zod-validated env (`AUTH_SECRET`, token TTLs), `PrismaService`/`PrismaModule`, `PasswordService` (argon2id), `TokenService`, `AuthService` (register/login/refresh/logout/me), `JwtStrategy` + `JwtAuthGuard` registered **globally** (`APP_GUARD`) with a `@Public()` opt-out — every route is protected by default. A minimal `GET /categories` endpoint scoped by `req.user.id` — the smallest real vertical slice that proves the guard and per-user scoping actually work, ahead of full Phase 4 Category CRUD.
- Registration seeds the 15 default categories for the new user (refactored `seedDefaultCategories` helper, shared with the local-dev seed script).
- Shared `packages/types` (`AuthenticatedUser`, `AuthTokens`, `AuthResponse`) and `packages/validation` (`registerSchema`, `loginSchema`) contracts. `packages/api-client` now handles Bearer-token attachment and a transparent refresh-and-retry-once on 401.
- Web (`apps/web`): `AuthProvider` context, `/login` and `/register` pages (React Hook Form + Zod), a protected `/dashboard` placeholder.
- Mobile (`apps/mobile`): matching `AuthProvider`, `login`/`register` screens, the protected home screen redirects to `/login` when unauthenticated.
- Tests: 18 API unit tests (password/token/auth services, mocked Prisma), 9 `api-client` unit tests (including the refresh-and-retry flow), 11 Testcontainers integration tests including the **critical test** — two real registered users, neither can see the other's categories via `GET /categories` — plus web/mobile component tests for the login flow.
- Wrote `docs/architecture/security.md`.
- Verified `pnpm quality` passes end to end (format, lint, typecheck, all unit tests, all integration tests, all builds) — exit code 0.

## In Progress

- None.

## Next Task

1. **Sync the local dev database** (left over from Phase 3 — see Known Issues): run the four commands listed there, then confirm `pnpm --filter @budget-terry/api run start:dev` boots and `pnpm --filter @budget-terry/api run db:seed` succeeds against local Postgres.
2. **Manually smoke-test the real flow once local dev is synced** — this session verified everything through Testcontainers (real Postgres, real HTTP layer) but never against the actual `apps/web`/`apps/mobile` dev servers talking to a running local API. Worth 10 minutes once unblocked: register through the web UI, confirm the dashboard shows the right user, log out, log back in.
3. Begin **Phase 4 — Accounts and Categories**: full CRUD for both (create/edit/archive/list), building on the `GET /categories` slice already in place. Web and mobile UI for both.

## Known Issues

- **Local dev database still needs the Phase 3 migration applied.** The harness's auto-mode safety classifier blocked every `prisma migrate`/direct-SQL command touching the local dev Postgres in this session — including read-only ones — so this couldn't be completed automatically. The migration itself is correct and proven (11/11 integration tests pass applying it to a fresh Testcontainers database from empty); the local dev DB just has one leftover pre-auth seed row blocking it. Run, in order:
  ```bash
  cd apps/api
  docker exec budget-terry-postgres psql -U budget_terry -d budget_terry_dev -c "DELETE FROM users;"
  npx prisma migrate resolve --rolled-back 20260815000000_add_auth
  npx prisma migrate deploy
  pnpm run db:seed
  ```
- A few Section 69 review questions remain informally open (NZD-only for V2? multiple financial accounts in MVP? household budgeting postponed confirmed?) — minor/confirmatory, not architecturally blocking.
- `apps/mobile` peer-dependency warning: `jest-expo`'s `react-server-dom-webpack` wants a React 19 RC while the app pins React 18.3.1. Harmless so far; recheck after any Expo SDK upgrade.
- Prisma's `package.json#prisma` seed config is deprecated as of Prisma 6, removed in Prisma 7 (currently on 6.19.3) — migrate to `prisma.config.ts` on the next major upgrade.
- `Budget`'s "overall cap vs. per-category" invariant is not enforced by a DB constraint — validate at the service layer when the Budget API is built (Phase 7).
- Structured error model (plan Section 50), rate limiting on auth endpoints (plan Section 39, Phase 13 scope) — both deliberately deferred, documented in `docs/architecture/security.md`'s Known Gaps.

## Decisions Made

See `AGENTS.md` §2 for the quick-reference summary, and `docs/adr/ADR-001` through `ADR-011` for full rationale on each. Note ADR-003 was revised in place on 2026-08-15 (real auth built in Phase 3, not deferred) — read the revision note, not just the original Decision section.

## Commands Verified

```bash
pnpm install
docker compose up -d                                            # local Postgres, healthy
pnpm --filter @budget-terry/api run db:generate
pnpm --filter @budget-terry/api run test:integration              # 11/11 pass, real Testcontainers Postgres
pnpm format / pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm quality        # PASS, exit code 0
```

Not yet verified this session (blocked — see Known Issues): `prisma migrate deploy` / `db:seed` against the actual local dev Postgres; the real `apps/web`/`apps/mobile` dev servers against a running local `apps/api`.

## Last Quality Gate

PASS (2026-08-16) — `pnpm quality` exit code 0, including Phase 3's new unit and integration tests.

## Resume Instructions

1. Read `docs/budget-terry-v2-plan-updated.md`.
2. Read this file (`PROJECT_STATUS.md`).
3. Read `AGENTS.md`.
4. Read `docs/architecture/data-model.md`, `docs/architecture/security.md`, and `docs/adr/ADR-001` through `ADR-011` (especially the ADR-003 revision note and ADR-011).
5. Run `git status`.
6. Confirm Docker Desktop is running, `docker compose up -d`, then complete the local-dev-database sync under Known Issues if not already done.
7. Continue with the task listed under **Next Task** above.
