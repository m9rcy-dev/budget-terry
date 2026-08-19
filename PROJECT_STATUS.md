# Project Status

Last Updated: 2026-08-19
Current Phase: Phase 5 — Transactions (not started)
Current Task: See Next Task below

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
- Extended the Prisma schema: `User.passwordHash`, new `RefreshToken` table. Migration `20260815000000_add_auth` — written by hand (the usual `prisma migrate diff`/`reset` tooling was blocked by the harness's safety classifier for touching a live database) and proven correct by integration tests applying it to a fresh Testcontainers Postgres from empty.
- Backend (`apps/api`): `@nestjs/config` + Zod-validated env, `PrismaService`/`PrismaModule`, `PasswordService` (argon2id), `TokenService`, `AuthService` (register/login/refresh/logout/me), `JwtStrategy` + `JwtAuthGuard` registered **globally** with a `@Public()` opt-out — every route is protected by default.
- Registration seeds the 15 default categories for the new user (`seedDefaultCategories` helper, shared with the local-dev seed script).
- Shared `packages/types` (`AuthenticatedUser`, `AuthTokens`, `AuthResponse`) and `packages/validation` (`registerSchema`, `loginSchema`). `packages/api-client` handles Bearer-token attachment and a transparent refresh-and-retry-once on 401.
- Web and mobile: `AuthProvider` context, login/register screens, a protected home area.
- Wrote `docs/architecture/security.md`.
- Verified `pnpm quality` passes end to end. Committed locally: "Add Phase 3 authentication".

### Phase 4 — Accounts and Categories

- Full CRUD for both resources: create/list/get/update/archive/restore/delete. Every query is scoped by `req.user.id` **in the query itself** (`findFirst({ where: { id, userId } })`), never fetch-then-check — another user's resource is indistinguishable from a nonexistent one.
- Delete relies on the DB's `Restrict` FK constraint (ADR-008) rather than a separate reference-count query: catch the `P2003` foreign-key-violation error and turn it into a 409, rather than pre-checking for references. Same pattern applied to `P2002` (unique constraint) for duplicate category names, on both `create` and rename — a real gap the integration tests surfaced (a raw 500 instead of a clean 409) and which got fixed before merging, not after.
- Shared `packages/validation` (`createAccountSchema`, `updateAccountSchema` — currency deliberately not editable — `createCategorySchema`, `updateCategorySchema`) and `packages/types` (`Account`, `Category`).
- **Found and fixed a real bug in `packages/api-client`**: `request()` unconditionally called `response.json()` on every successful response, which throws on a genuine 204 No Content body (used by every `DELETE` and by `logout()`). The Phase 3 unit tests didn't catch this because the fake `fetch` used in those tests incorrectly attached a JSON body to its mocked 204 responses — real 204s have no body. Fixed, covered by a dedicated regression test using an actually-empty `Response`.
- Added typed resource helpers to `packages/api-client` (`packages/api-client/src/resources/{accounts,categories}.ts`) shared between web and mobile.
- Web and mobile: `/accounts` and `/categories` — list (with a "show archived" toggle), create, archive/restore. Functional, minimally styled (the Warm Ledger design system is separate future work, not part of this phase).
- Tests: 16 new backend unit tests (36 total), 11 new integration tests (22 total) including two more critical isolation tests (a user cannot read/edit/archive/delete another user's account or category), 1 new `api-client` regression test (10 total).
- Verified `pnpm quality` passes end to end — 58 tests across the workspace, exit code 0. Committed locally: "Add Phase 4 accounts and categories".

### Post-Phase-4 — Local DB Sync and a Real Runtime Bug

- **Local dev database synced** (the blocker carried over from Phase 3): deleted the one leftover pre-auth seed row, ran `prisma migrate resolve --rolled-back`, `prisma migrate deploy`, `pnpm run db:seed`. Local Postgres now matches the schema and has the dev account (`dev@budgetterry.local`) seeded.
- **Found and fixed a real, previously-undetected bug** while smoke-testing the actual API dev server for the first time: `pnpm --filter @budget-terry/api run start:dev` failed immediately with `ERR_MODULE_NOT_FOUND`. Root cause: `packages/types`, `validation`, `api-client`, and `ui` were all `"type": "module"`, compiled with `moduleResolution: "Bundler"` (extensionless relative imports) — fine for Vitest/webpack/Metro, but Node's native ESM loader (what `nest start`/`node dist/main.js` actually uses) requires explicit `.js` extensions on relative imports, which TypeScript's Bundler mode never adds. This had been latent since Phase 1: `tsc --noEmit`, Jest (its own resolver), and `nest build` (compiles but never executes the output) all passed without ever actually running the app. **Fixed** by compiling all four shared packages as CommonJS instead (matching `apps/api`'s own module system, the actual Node runtime consumer) — removed `"type": "module"` from each `package.json`, added `module`/`moduleResolution` overrides to each `tsconfig.json`. Verified safe for web/mobile (both bundlers handle CJS dependencies routinely).
- **Actually ran the real dev servers for the first time this project**: `apps/api` boots cleanly, all routes map correctly; `curl`-tested `/health`, `/auth/login` (real login against the synced local DB), `GET /categories` with and without a token (200 with 15 categories / 401 without). `apps/web`'s dev server boots and serves `/login` with real content. Both shut down cleanly after.
- Re-ran `pnpm quality` after the fix — still exit code 0, 92 tests total across the workspace.
- Takeaway worth remembering: **passing tests and a passing `build` step do not prove an app actually runs** — `nest build` only compiles, Jest has its own module resolution distinct from Node's. Actually booting the dev server periodically (not just at the very end of a phase) would have caught this sooner.

## In Progress

- None.

## Next Task

Begin **Phase 5 — Transactions**: create/edit/delete expense and income, listing with pagination/filters/search, category totals. This is the phase the plan calls "the first milestone where the product becomes genuinely useful" (Section 60) — it's also where the `Idempotency-Key` header (ADR-007) needs to actually be wired up on the create endpoint, and where `Transaction.relatedBillOccurrenceId`/`relatedGoalContributionId` linkage (ADR-005) starts to matter, even though Bills/Goals themselves are later phases.

Suggested habit going forward, given the runtime-bug lesson above: boot `apps/api` (and ideally `apps/web`) at least once per phase, not just at the very end — `pnpm quality` passing is necessary but not sufficient evidence the app works.

## Known Issues

- A few Section 69 review questions remain informally open (NZD-only for V2? multiple financial accounts in MVP? household budgeting postponed confirmed?) — minor/confirmatory, not architecturally blocking.
- `apps/mobile` peer-dependency warning: `jest-expo`'s `react-server-dom-webpack` wants a React 19 RC while the app pins React 18.3.1. Harmless so far; recheck after any Expo SDK upgrade.
- Prisma's `package.json#prisma` seed config is deprecated as of Prisma 6, removed in Prisma 7 (currently on 6.19.3) — migrate to `prisma.config.ts` on the next major upgrade.
- `Budget`'s "overall cap vs. per-category" invariant is not enforced by a DB constraint — validate at the service layer when the Budget API is built (Phase 7).
- Structured error model (plan Section 50), rate limiting on auth endpoints (plan Section 39, Phase 13 scope) — both deliberately deferred, documented in `docs/architecture/security.md`'s Known Gaps.
- Web/mobile Accounts/Categories UI supports create/archive/restore but not inline editing yet (rename/change-type) — the API supports it (`PATCH`), the UI just doesn't expose it. Small follow-up, not a blocker.

## Decisions Made

See `AGENTS.md` §2 for the quick-reference summary, and `docs/adr/ADR-001` through `ADR-011` for full rationale on each. Note ADR-003 was revised in place on 2026-08-15 (real auth built in Phase 3, not deferred) — read the revision note, not just the original Decision section.

## Commands Verified

```bash
pnpm install
docker compose up -d                                              # local Postgres, healthy
docker exec budget-terry-postgres psql -U budget_terry -d budget_terry_dev -c "DELETE FROM users;"
npx prisma migrate resolve --rolled-back 20260815000000_add_auth   # (from apps/api)
npx prisma migrate deploy                                         # applied cleanly to local dev DB
pnpm --filter @budget-terry/api run db:generate
pnpm --filter @budget-terry/api run db:seed                       # dev@budgetterry.local seeded
pnpm --filter @budget-terry/api run start:dev                     # boots cleanly, all routes mapped
curl http://localhost:3001/health                                 # {"status":"ok"}
curl -X POST http://localhost:3001/auth/login ...                 # real login against local DB, works
curl http://localhost:3001/categories -H "Authorization: Bearer ..." # 200, 15 categories
curl http://localhost:3001/categories                             # 401 with no token
pnpm --filter @budget-terry/web run dev                           # boots cleanly
curl http://localhost:3000/login                                  # 200, real page content
pnpm --filter @budget-terry/api run test:integration               # 22/22 pass, real Testcontainers Postgres
pnpm format / pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm quality        # PASS, exit code 0, 92 tests total
```

## Last Quality Gate

PASS (2026-08-19) — `pnpm quality` exit code 0, 92 tests across the workspace. Also verified by actually running both `apps/api` and `apps/web` dev servers against the real local database (see Post-Phase-4 fix above) — not just tests/build passing.

## Resume Instructions

1. Read `docs/budget-terry-v2-plan-updated.md`.
2. Read this file (`PROJECT_STATUS.md`).
3. Read `AGENTS.md`.
4. Read `docs/architecture/data-model.md`, `docs/architecture/security.md`, and `docs/adr/ADR-001` through `ADR-011` (especially the ADR-003 revision note and ADR-011).
5. Run `git status`.
6. Confirm Docker Desktop is running (`docker compose up -d`) — local dev DB is already synced, no further action needed.
7. Continue with the task listed under **Next Task** above.
