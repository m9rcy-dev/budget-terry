# Project Status

Last Updated: 2026-08-19
Current Phase: Phase 7 — Budgets (not started)
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

### Phase 5 — Transactions

The plan calls this "the first milestone where the product becomes genuinely useful" (Section 60) — the app can now actually track money.

- Full CRUD for `Transaction`: create (expense/income — `TRANSFER` deliberately excluded, per ADR-005/plan Section 18, until transfers get dedicated linked-entry handling later), list with pagination + filters (account/category/type/date range) + search (merchant/description, case-insensitive), get one, edit, delete. Creating or editing a transaction verifies the referenced account/category actually belongs to the caller (reuses `AccountsService`/`CategoriesService.findOneForUser`, now exported from their modules) — the same ownership-in-the-query pattern as Phase 4, extended to a resource that references two others.
- **`Idempotency-Key` (ADR-007) is now actually wired up**, not just designed: the header is read on `POST /transactions`, checked against the existing `(userId, idempotencyKey)` unique constraint before creating, and a concurrent-race fallback (catch the `P2002`, re-fetch, return the winner) handles two requests with the same key arriving at once. Verified for real against the live local API, not just integration tests: two identical `curl` requests with the same `Idempotency-Key` returned the identical transaction id.
- `GET /transactions/category-totals` — `groupBy` on `EXPENSE` transactions within a date range, joined with category names, with an explicit "Uncategorized" bucket for transactions with no category (rather than silently dropping them).
- Route ordering matters and is easy to get wrong: `category-totals` must be registered before the `:id` route or Express matches it as an id first (`ParseUUIDPipe` would then reject it) — got this right, noted in a comment so it doesn't regress.
- Shared `packages/validation` (`createTransactionSchema`, `updateTransactionSchema`, `listTransactionsQuerySchema`, `categoryTotalsQuerySchema`) and `packages/types` (`Transaction`, `PaginatedResult<T>`, `CategoryTotal`). `packages/api-client` gained typed resource helpers including query-string building for filters.
- Web: `/transactions` — create form (expense/income toggle, account/category pickers, dollar-amount input converted to minor units client-side, date, merchant), filterable/paginated list, inline amount edit, delete.
- Mobile: `/transactions` — a quick-entry flow (type/account/category as tappable chips, amount input, defaults to today) plus a recent-transactions list with delete, matching the plan's emphasis on fast mobile entry (Section 53) rather than mirroring web's full edit UI.
- Tests: 9 new backend unit tests (45 total) — including the idempotency race and the Uncategorized-bucket mapping — 8 new integration tests (30 total) including a critical isolation test (a user cannot read/edit/delete another user's transaction, or create one against another user's account) and a dedicated idempotency-replay test.
- **Followed the new AGENTS.md guidance this time**: booted the real `apps/api` dev server against the synced local database mid-verification (not just at the end) and smoke-tested create/list/category-totals/idempotency-replay with real `curl` requests against real local Postgres data — all matched what the integration tests predicted.
- Verified `pnpm quality` passes end to end — exit code 0. Committed locally: "Add Phase 5 transactions".

### Phase 6 — Dashboard V1

The first phase that turns raw CRUD (Phases 4–5) into the "useful answers" the product principles call for (plan Section 2.2) — no new entities, just aggregation.

- `GET /dashboard/summary?from=&to=` — a single endpoint combining current-period income, expenses, net, category totals, and the 5 most recent transactions. Built by composing existing services (`TransactionsService.getCategoryTotals`/`findAllForUser`, now exported from `TransactionsModule`) rather than duplicating query logic — income/expenses use a small new `Prisma.aggregate` sum, everything else is reuse.
- **No Budget entity exists yet** (that's Phase 7's payday-anchored periods per ADR-006), so "current period" defaults to the current calendar month when `from`/`to` are omitted — a deliberate, documented placeholder, not an oversight. Revisit once Phase 7 gives the dashboard a real period to align with.
- `recentTransactions` is deliberately **not** scoped to the queried `from`/`to` range — "recent activity" and "this period's numbers" are different questions, and conflating them would hide a transaction dated outside the selected range that the user just entered. Caught this exact distinction via a failing integration test assertion before it became a UI bug.
- Shared `packages/types` (`DashboardSummary`) and `packages/validation` (`dashboardSummaryQuerySchema`). Pulled the `isoDateSchema` primitive out of `transaction.ts` into its own `date.ts` now that a third consumer needs it.
- Web `/dashboard`: real income/expenses/remaining figures, a ranked-bar category breakdown (bars sized proportionally, not a pie chart — per plan Section 70's "the numbers are the design" / bars-before-pie-charts guidance), and a recent-transactions list.
- Mobile home screen: the same summary data, replacing the placeholder "logged in as" text — matching the plan's Home-tab-as-dashboard structure (Section 53).
- Tests: 5 new backend unit tests (50 total), 4 new integration tests (34 total) including a critical isolation test and a default-period test. Mobile gained its first test covering real fetched data rendering (previously only auth-state rendering was tested), fixing an `act()` warning properly (an explicit `waitFor` on the mock call) rather than suppressing it.
- Verified `pnpm quality` passes end to end — exit code 0, 127 tests total. Booted `apps/api` against the real local database mid-verification and confirmed `/dashboard/summary` correctly picked up the actual transactions created during Phase 5's own smoke test — real data, not fixtures. Committed locally: "Add Phase 6 dashboard" (pending — see below).

## In Progress

- None.

## Next Task

Begin **Phase 7 — Budgets**: create budget (overall or per-category, per plan Section 4), budget-period calculation using `Budget.period`/`anchorDate` (ADR-006 — this is where the dashboard's calendar-month placeholder should be revisited and possibly aligned with the user's real budget period), spending-against-budget, remaining amount, percentage used, budget warnings (healthy/approaching/exceeded), web + mobile budget UI. Note ADR-002's Budget schema decision: an "overall cap vs. per-category" invariant isn't DB-enforced — validate it at the service layer now that this phase actually builds against it.

Continue the habit: boot `apps/api` (and `apps/web`) mid-phase, not just at the end.

## Known Issues

- A few Section 69 review questions remain informally open (NZD-only for V2? multiple financial accounts in MVP? household budgeting postponed confirmed?) — minor/confirmatory, not architecturally blocking.
- `apps/mobile` peer-dependency warning: `jest-expo`'s `react-server-dom-webpack` wants a React 19 RC while the app pins React 18.3.1. Harmless so far; recheck after any Expo SDK upgrade.
- Prisma's `package.json#prisma` seed config is deprecated as of Prisma 6, removed in Prisma 7 (currently on 6.19.3) — migrate to `prisma.config.ts` on the next major upgrade.
- Structured error model (plan Section 50), rate limiting on auth endpoints (plan Section 39, Phase 13 scope) — both deliberately deferred, documented in `docs/architecture/security.md`'s Known Gaps.
- Web/mobile Accounts/Categories UI supports create/archive/restore but not inline editing yet (rename/change-type) — the API supports it (`PATCH`), the UI just doesn't expose it. Small follow-up, not a blocker.
- Web/mobile Transactions UI doesn't expose changing which account/category a transaction belongs to during edit (only amount/merchant on web; mobile has no edit UI at all, by design — see Phase 5 above). The API supports full edits.
- Dashboard's "current period" is a calendar-month placeholder, not tied to any real budget period — see Next Task, this is exactly what Phase 7 should resolve.

## Decisions Made

See `AGENTS.md` §2 for the quick-reference summary, and `docs/adr/ADR-001` through `ADR-011` for full rationale on each. Note ADR-003 was revised in place on 2026-08-15 (real auth built in Phase 3, not deferred) — read the revision note, not just the original Decision section.

## Commands Verified

```bash
pnpm install
docker compose up -d                                              # local Postgres, healthy
pnpm --filter @budget-terry/api run start:dev                     # boots cleanly, all routes mapped
curl http://localhost:3001/health                                 # {"status":"ok"}
curl -X POST http://localhost:3001/auth/login ...                 # real login against local DB, works
curl http://localhost:3001/dashboard/summary ...                  # correct income/expenses/net/categories,
                                                                    # picked up real transactions from Phase 5's own smoke test
pnpm --filter @budget-terry/api run test:integration               # 34/34 pass, real Testcontainers Postgres
pnpm format / pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm quality        # PASS, exit code 0
```

## Last Quality Gate

PASS (2026-08-19) — `pnpm quality` exit code 0, 127 tests across the workspace (93 unit + 34 integration). Also verified by actually running `apps/api` against the real local database mid-phase and confirming `/dashboard/summary` reflected real prior data correctly — not just tests/build passing.

## Resume Instructions

1. Read `docs/budget-terry-v2-plan-updated.md`.
2. Read this file (`PROJECT_STATUS.md`).
3. Read `AGENTS.md`.
4. Read `docs/architecture/data-model.md`, `docs/architecture/security.md`, and `docs/adr/ADR-001` through `ADR-011` (especially the ADR-003 revision note and ADR-011).
5. Run `git status`.
6. Confirm Docker Desktop is running (`docker compose up -d`) — local dev DB is already synced, no further action needed.
7. Continue with the task listed under **Next Task** above.
