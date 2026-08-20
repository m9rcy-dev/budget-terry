# Project Status

Last Updated: 2026-08-20
Current Phase: Phase 9 — Calendar (complete)
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

### Phase 7 — Budgets

The plan's Section 4 budgeting feature: an "overall cap or per-category" budget, tracked against a configurable, payday-anchored period (ADR-006), with live spend/remaining/status computed on read.

- `budget-period.ts` — the algorithmically tricky piece, isolated and unit-tested on its own: `computeCurrentPeriod(period, anchorDate, referenceDate)` walks forward from `anchorDate` in whole period-lengths (WEEKLY=7d/FORTNIGHTLY=14d via integer day-division, MONTHLY via integer month arithmetic with day-of-month clamping) — deliberately not calendar-aligned, matching a real payday cadence. 15 unit tests, including end-of-month clamping (31st anchor landing in Feb, both leap and non-leap years) and a full-year walk-forward drift check.
- `BudgetsService`: create/list/get/update/delete, all ownership-scoped (`findFirst({ id, userId })`, same pattern as every other resource). The overall-vs-per-category XOR invariant (ADR-002/ADR-006 note) isn't DB-enforced — validated at the Zod layer (`createBudgetSchema`'s `superRefine`, also rejecting duplicate `categoryId`s) and re-verified in the service. Status/spend/remaining/percentage are **computed on read, never stored** (same principle as Phase 2's bill-status ADR-010) — a small `attachStatus` step branches on overall vs. per-category and calls `prisma.transaction.aggregate` (income deliberately excluded from "spent"). `update` uses a `$transaction` to `deleteMany` the old `BudgetCategory` rows and `create` new ones — full-replace semantics, not a merge.
- Category allocations reuse `CategoriesService.findOneForUser` for ownership verification — allocating another user's category correctly 404s, not 403 (consistent with how every other cross-resource reference is guarded).
- Shared `packages/validation` (`createBudgetSchema`/`updateBudgetSchema`, the XOR `superRefine`) and `packages/types` (`Budget`, `BudgetCategoryStatus`, `BudgetStatus`). `packages/api-client` gained typed resource helpers.
- Web `/budgets`: list showing a status bar per budget (or per category, for per-category budgets) — color plus an explicit text label ("Healthy"/"Approaching limit"/"Over budget"), never color alone, per plan Section 54's accessibility guidance. Create form toggles overall vs. per-category; edit reuses the same form pre-populated (since update is full-replace, this maps naturally); delete.
- Mobile `/budgets`: the same overall/per-category toggle and status bars, adapted to a chip-based picker (tap a category to include it, then an amount field appears) rather than a full form, matching the mobile-quick-entry pattern established in Phase 5.
- Tests: 17 new backend unit tests for `BudgetsService` (82 total) plus 15 for `budget-period` (counted above), 8 new integration tests (42 total) covering overall spend calculation, per-category spend calculation (proving another category's spending doesn't bleed in), both XOR rejection cases, foreign-category-ownership rejection, edit-replaces-allocations, delete, and a critical isolation test.
- Caught and fixed two bugs before they shipped: a TS2502 "referenced in its own type annotation" error in the service spec caused by a `$transaction` mock callback parameter shadowing the outer `tx` const of the same name (renamed the parameter); and two `it.each` boundary-value test cases that were arithmetically wrong (79999/100000 asserted as `APPROACHING` when it's actually `HEALTHY` at 79.999%) — fixed by using clean round percentages that don't hit rounding ambiguity.
- Verified `pnpm quality` passes end to end — exit code 0, 173 tests total (131 unit + 42 integration). Booted `apps/api` against the real local database mid-verification and smoke-tested the full budget lifecycle with `curl`: overall budget creation, live spend/remaining/status after adding a real expense transaction, per-category XOR budget creation, the 400 rejection when both `totalAmountMinorUnits` and `categoryAllocations` are sent, and delete → 404. Also booted `apps/web` and confirmed `/budgets` compiles and serves 200. Committed locally: "Add Phase 7 budgets".

### Phase 8 — Bills

The plan's Section 5 bills feature: known/expected payments, one-off or recurring, tracked through a six-state display status, with "mark paid" feeding straight into the transaction ledger (ADR-005).

- `bill-recurrence.ts` — occurrence date generation and display-status mapping, isolated and unit-tested like `budget-period.ts` before it. `generateOccurrenceDates(recurrence, from, horizonEnd)` always includes `from` (the caller's explicit starting date) then steps forward (WEEKLY/FORTNIGHTLY by days, MONTHLY/QUARTERLY/YEARLY by clamped months, reusing the `addUtcDays`/`addUtcMonthsClamped` helpers now extracted to `apps/api/src/common/date-utils.ts` and shared with `budget-period.ts`) while within the horizon. `computeDisplayStatus` maps stored `PENDING`/`PAID`/`SKIPPED` + `dueDate` to the plan's six states (`UPCOMING`/`DUE_SOON`/`DUE_TODAY`/`OVERDUE`/`PAID`/`SKIPPED`) — PAID/SKIPPED pass straight through, PENDING is split by comparing to `today`. ADR-010 deliberately left two product decisions open for this phase to make: a 90-day occurrence-generation horizon, and a 7-day "due soon" window — both documented inline, not hidden magic numbers. 22 unit tests, including month-clamping across recurrence types and every display-status boundary.
- **No batch job generates future occurrences.** `BillsService.ensureOccurrencesGenerated` tops up a recurring bill's occurrences opportunistically whenever it's read (list or get) — if the last occurrence falls short of the 90-day horizon, it generates forward from there. ONE_OFF bills and archived bills never generate more. This keeps the "computed / generated on read, not by a cron job" principle established by ADR-010 consistent across the codebase.
- **`markOccurrencePaid` atomically creates the linked Transaction** (ADR-005) inside a `$transaction` alongside the occurrence's status update — `EXPENSE`, dated today, using the bill's default account/category (or an explicitly provided `accountId` when the bill has none). Idempotent: calling it again on an already-PAID occurrence returns the existing state without creating a second transaction — verified with a real double-call integration test, not just unit-mocked. `markOccurrenceSkipped` is idempotent on repeat `SKIPPED` calls and rejects (409) skipping an occurrence that's already been paid.
- Editing a bill's `amountMinorUnits` propagates to its still-`PENDING` occurrences but never to `PAID`/`SKIPPED` ones — a price change should affect what's still owed, not rewrite settled history. Currency, recurrence, and `firstDueDate` are deliberately not editable (changing recurrence would require regenerating the future series, out of scope this phase — archive and recreate instead), same "not editable" precedent as `Account.currency`.
- No hard delete for bills — the plan's Phase 8 task list never lists one, and every bill always has at least one occurrence, so it would follow the same "archive instead" path every other archivable resource takes anyway (ADR-008). Archive/restore only, mirroring Accounts/Categories.
- Shared `packages/validation` (`createBillSchema`, `updateBillSchema`, `markBillOccurrencePaidSchema`) and `packages/types` (`Bill`, `BillOccurrence`, `BillRecurrenceType`, `BillDisplayStatus`). `packages/api-client` gained typed resource helpers including the two occurrence actions.
- Web `/bills`: create form (name/amount/recurrence/first due date/optional category+account), list showing each occurrence with a status dot plus explicit text label (never color-only, per plan Section 54), Pay/Skip actions on PENDING occurrences, archive/restore toggle with a "show archived" checkbox.
- Mobile `/bills`: the same chip-based quick-entry pattern established in Phase 5/7 (recurrence/category/account as tappable chips), status dot + label per occurrence, Pay/Skip/Archive actions.
- Tests: 20 new backend unit tests for `BillsService` (124 total) plus 22 for `bill-recurrence` (counted above), 9 new integration tests (51 total) covering one-off vs. recurring occurrence generation, paid-creates-linked-transaction (verified by re-fetching the transaction, not just trusting the response), paid-twice-doesn't-duplicate, the no-default-account 400, skip/paid-conflict, archive-stops-generation-keeps-history, amount-edit-propagation, and a critical isolation test covering read/edit/pay/skip/archive.
- Verified `pnpm quality` passes end to end — exit code 0, 235 tests total (184 unit + 51 integration). Booted `apps/api` against the real local database mid-verification and smoke-tested the full bill lifecycle with `curl` before the test suite was even finished (create recurring bill, pay first occurrence, confirm idempotent re-pay, skip a later occurrence, reject skip-after-paid, create a ONE_OFF bill, archive) — caught this phase's logic working correctly before formalizing it into tests, not after. Also booted `apps/web` and confirmed `/bills` compiles and serves 200. Committed locally: "Add Phase 8 bills".

### Phase 9 — Calendar

The plan's Section 6 feature: month/week/agenda views surfacing bills and expected income together, paid/unpaid/overdue visually distinguished, selecting an entry opens its detail. Built as presentation over data Phases 5–8 already produce — no new domain entities, same "compose existing services" shape as Phase 6's dashboard.

- **Single flat, date-sorted endpoint, not three view-specific ones**: `GET /calendar/entries?from=&to=` returns `CalendarEntry[]` (a `BILL` | `INCOME` discriminated union). Month/week/agenda are a client-side rendering concern over the same data — the frontend picks the date range for whichever view it's showing and lays the same entries out differently. `from`/`to` are both required (unlike the dashboard's optional-with-calendar-month-default) since a calendar view always has a concrete range to display; there's no natural default to fall back to.
- `CalendarService` composes two new range-query methods rather than duplicating query logic: `BillsService.findOccurrencesDueInRange` (reuses `computeDisplayStatus` from Phase 8's `bill-recurrence.ts` for the same six-state status) and `TransactionsService.findIncomeInRange`. `BillsService` and `TransactionsModule` were exported/imported accordingly.
- Two deliberate scope decisions, documented inline rather than silently deviating from the plan: (1) **"Expected income" means actually-recorded income transactions in range, not a forecast** — the plan's Section 69 review question "Should salary/payday recurrence be part of MVP?" was never resolved with a recurring-income entity, so there's nothing to forecast from; this is the data-grounded interpretation consistent with the project's "computed from real data" principle throughout. (2) **"Optional savings contributions" aren't included yet** — `GoalContribution` doesn't exist until Phase 10; the `CalendarEntry` union has a comment flagging this to revisit.
- Calendar entries include occurrences from **archived** bills (a deliberate exception to the default-hide-archived convention used by Bill/Account/Category list endpoints) — the calendar is a factual record of what's due/was due on a date, not an ongoing management list.
- Known, documented limitation: `findOccurrencesDueInRange` doesn't top up occurrence generation the way `BillsService.findOneForUser`/`findAllForUser` do — a bill whose occurrences haven't been generated that far ahead (beyond the 90-day horizon from Phase 8) simply won't appear on the calendar until a later bill list/get call tops it up. Acceptable given calendar browsing realistically stays within that horizon; noted as a Known Issue below.
- Shared `packages/types` (`CalendarEntry`, `CalendarBillEntry`, `CalendarIncomeEntry`) and `packages/validation` (`calendarQuerySchema`). `packages/api-client` gained `getCalendarEntries`.
- Web `/calendar`: a Monday-first month grid (status-colored dots per day, clicking a day jumps to its agenda section) plus a full agenda list below matching the plan's Section 6 example format exactly (grouped by date, bill/income lines with amounts) — every status shown as a dot *and* text label, never color alone (plan Section 54). Pay/Skip act inline on bill entries, reusing Phase 8's bill actions directly rather than a separate detail modal.
- Mobile `/calendar`: agenda-only (no month grid — impractical on a small screen without a calendar-grid dependency this project doesn't have), same status indicators, Pay/Skip inline, month Previous/Next navigation.
- Tests: 5 new backend unit tests for `CalendarService` (129 total, mocked `BillsService`/`TransactionsService` composition), 5 new integration tests (56 total) covering the bills+income merge/sort, range exclusion, archived-bill inclusion, the required-params 400, and a critical isolation test.
- Verified `pnpm quality` passes end to end — exit code 0, 245 tests total (189 unit + 56 integration). Booted `apps/api` against the real local database mid-phase (before the integration tests were even written) and smoke-tested `/calendar/entries` with `curl` — confirmed bill occurrence + income entries both appear, correctly sorted, with out-of-range entries excluded — before formalizing the behavior into tests. Also booted `apps/web` and confirmed `/calendar` serves 200 with live data. Committed locally: "Add Phase 9 calendar".

## In Progress

- None.

## Next Task

Phase 9 is complete. Re-read plan Section 60 for Phase 10 — Savings Goals: `SavingsGoal`/`GoalContribution` CRUD (both already scaffolded in the Phase 2 schema — `currentAmountMinorUnits` deliberately NOT stored, summed from contributions live, same principle as every other computed-not-cached figure in this codebase), progress/remaining/percentage computed on read, a contribution atomically creating a linked `Transaction` (ADR-005 — same pattern Phase 8 already proved out for bill payments), and plan Section 8's "Payday Contributions" concept (suggested/manual contribution allocation across goals). Web + mobile UI, tests.

Continue the habit: boot `apps/api` (and `apps/web`) mid-phase, not just at the end.

## Known Issues

- A few Section 69 review questions remain informally open (NZD-only for V2? multiple financial accounts in MVP? household budgeting postponed confirmed?) — minor/confirmatory, not architecturally blocking.
- `apps/mobile` peer-dependency warning: `jest-expo`'s `react-server-dom-webpack` wants a React 19 RC while the app pins React 18.3.1. Harmless so far; recheck after any Expo SDK upgrade.
- Prisma's `package.json#prisma` seed config is deprecated as of Prisma 6, removed in Prisma 7 (currently on 6.19.3) — migrate to `prisma.config.ts` on the next major upgrade.
- Structured error model (plan Section 50), rate limiting on auth endpoints (plan Section 39, Phase 13 scope) — both deliberately deferred, documented in `docs/architecture/security.md`'s Known Gaps.
- Web/mobile Accounts/Categories UI supports create/archive/restore but not inline editing yet (rename/change-type) — the API supports it (`PATCH`), the UI just doesn't expose it. Small follow-up, not a blocker.
- Web/mobile Transactions UI doesn't expose changing which account/category a transaction belongs to during edit (only amount/merchant on web; mobile has no edit UI at all, by design — see Phase 5 above). The API supports full edits.
- Dashboard's "current period" is still a calendar-month placeholder (Phase 6), not aligned to a user's real budget period now that Phase 7 has one — small follow-up to make the dashboard period-aware, not a blocker.
- Bills UI (web + mobile) doesn't expose editing an existing bill's fields (name/amount/category/account/notes) — the API supports it (`PATCH /bills/:id`), the UI only offers create/pay/skip/archive. Same category of gap as Accounts/Categories above, not a blocker.
- Mobile bill creation always uses today's date as `firstDueDate` (no date picker component yet) — same simplification already accepted for mobile budget creation's `anchorDate` in Phase 7. Web's bill form does expose a real date picker.
- Calendar entries for a recurring bill can go missing beyond the 90-day occurrence-generation horizon until a bill list/get call tops it up (see Phase 9 above) — not a bug, a documented consequence of no batch job existing. Low practical impact since a calendar view realistically stays within a few months.
- Calendar doesn't show savings contributions yet (plan Section 6's "Optional savings contributions") — `GoalContribution` doesn't exist until Phase 10; revisit `CalendarService`/`CalendarEntry` once it does.

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
curl -X POST http://localhost:3001/budgets ... totalAmountMinorUnits  # overall budget, live spend/remaining/status after a real expense
curl -X POST http://localhost:3001/budgets ... categoryAllocations    # per-category budget, correct XOR fields (overall fields null)
curl -X POST http://localhost:3001/budgets ... both fields set        # 400, rejected by Zod superRefine
curl -X DELETE http://localhost:3001/budgets/:id                      # 204, then GET same id -> 404
curl -X POST http://localhost:3001/bills ... recurrence MONTHLY       # bill created with 3+ generated occurrences
curl -X POST http://localhost:3001/bills/:id/occurrences/:occId/pay   # occurrence -> PAID, relatedTransactionId set
curl -X POST http://localhost:3001/bills/:id/occurrences/:occId/pay   # called again -> 201, same relatedTransactionId (idempotent)
curl -X POST http://localhost:3001/bills/:id/occurrences/:occId2/skip # occurrence -> SKIPPED
curl -X POST .../occurrences/:occId/skip (already PAID)               # 409
curl -X POST http://localhost:3001/bills/:id/archive                  # isArchived: true
curl http://localhost:3001/calendar/entries?from=&to=                 # bill + income entries merged, sorted by date
curl http://localhost:3001/calendar/entries (no from/to)              # 400, rejected by Zod
pnpm --filter @budget-terry/api run start:dev                     # /budgets, /bills, /calendar routes mapped, boots cleanly
pnpm --filter @budget-terry/web run dev                           # /budgets, /bills, /calendar compile, GET returns 200
pnpm --filter @budget-terry/api run test:integration               # 56/56 pass, real Testcontainers Postgres
pnpm format / pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm quality        # PASS, exit code 0
```

## Last Quality Gate

PASS (2026-08-20) — `pnpm quality` exit code 0, 245 tests across the workspace (189 unit + 56 integration). Also verified by actually running `apps/api` against the real local database mid-phase and smoke-testing `/calendar/entries` with `curl` (bill + income entries merged and sorted correctly), and by booting `apps/web` and confirming `/calendar` serves 200 with live data — not just tests/build passing.

## Resume Instructions

1. Read `docs/budget-terry-v2-plan-updated.md`.
2. Read this file (`PROJECT_STATUS.md`).
3. Read `AGENTS.md`.
4. Read `docs/architecture/data-model.md`, `docs/architecture/security.md`, and `docs/adr/ADR-001` through `ADR-011` (especially the ADR-003 revision note and ADR-011).
5. Run `git status`.
6. Confirm Docker Desktop is running (`docker compose up -d`) — local dev DB is already synced, no further action needed.
7. Continue with the task listed under **Next Task** above.
