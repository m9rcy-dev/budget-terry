# First-Time User Onboarding

**Status:** Draft — under review
**Date:** 2026-08-26

## Context

Working through the "accounts vs. budgets vs. bills vs. goals" product confusion surfaced a concrete, fixable gap: **accounts are the only concept that holds real money** — every transaction requires an `accountId` — while budgets/bills/goals are secondary constructs layered on top (budgets target a category+period, bills forecast recurring outflows, goals track savings, and both bills and goals optionally draw from an account). A brand-new user who lands on the dashboard and tries to add their first transaction before creating an account hits a confusing dead end today, and nothing in the product explains the relationship between these concepts.

The fix is two-part:

1. Document the concept model in the README, so it's written down once rather than re-explained.
2. A one-time onboarding flow for new signups: **mandatory** first-account creation (removes the dead end at the source), then an **optional, skippable checklist** ("want to set up a budget / bills / a goal now?") — deliberately a simple checklist, not an open-ended "what are your goals" questionnaire. Existing users are never retroactively forced through this.

## Decisions confirmed so far

- Onboarding runs **once per user**, only for brand-new signups. Existing users must not be forced through it retroactively — the migration backfills their `onboardingCompletedAt` so they're unaffected.
- Step 1 (**mandatory**, cannot skip): create the first Account.
- Step 2 (**skippable checklist**, not an open-ended questionnaire): "Want to set up anything else? You can always do this later." ☐ A monthly budget ☐ Upcoming bills ☐ A savings goal — each checked item leads to a minimal one-screen create-form, each individually skippable. A top-level _Skip for now_ link skips step 2 entirely.
- Account types are being trimmed as part of this work (see "Account Type Enum Change" below) — the mandatory account step shows the new `CHEQUE`/`SAVINGS`/`CREDIT_CARD`/`OTHER` chip set, not the old five-value list.
- Mini-forms for budget/bills/goal ask **bare-minimum required fields only** — fastest path to the dashboard; account-linking and other optional fields can be added later from the full pages.
- **Resume behavior**: if a user exits mid-flow after creating their mandatory account but before finishing/skipping step 2, they resume at the **checklist step** next time (not forced to create a second account) — detected by checking whether they already have ≥1 account on mount.
- Once the mandatory step is satisfied and step 2 is either completed or skipped, mark onboarding done server-side (so it never shows again) and land on the normal dashboard.
- Must work identically (mirrored logic) on both web and mobile.

This was researched and validated against the actual codebase (not assumed) — the plan below reflects corrections found during that research: the exact JWT guard pattern already used by `GET /auth/me`, how production migrations actually run (no separate backfill/hook step, so the backfill must be inline SQL), where `ApiClient` methods with token-lifecycle side effects live, and `budget`'s XOR validation between an overall total and per-category allocations.

## Account Type Enum Change

Separate but related decision, made while scoping the mandatory account step: `Account.type` (`EVERYDAY`, `SAVINGS`, `CREDIT_CARD`, `CASH`, `OTHER`) is purely a descriptive label today — confirmed by reading the codebase, nothing branches on it anywhere in `apps/api`. Decided: drop `CASH` (this app's usage is digital-only) and rename `EVERYDAY` → `CHEQUE` (the clearer term for an everyday/transaction account). Final enum: **`CHEQUE`, `SAVINGS`, `CREDIT_CARD`, `OTHER`**. `INCOME` was considered (for an "income breakdown" pie chart) but rejected as an account type — that analytics feature is better built off existing `Transaction.type`/`categoryId` data regardless of which account the transaction touched, and is tracked separately as feature request #3 below, not folded into this schema change.

0a. **`apps/api/prisma/schema.prisma`** — update `enum AccountType` (~line 21-26) to `CHEQUE`, `SAVINGS`, `CREDIT_CARD`, `OTHER` (remove `EVERYDAY`, `CASH`).

0b. **New migration** — Postgres 16 (`docker-compose.yml`) has no `ALTER TYPE ... DROP VALUE`; removing enum values requires the rename/recreate/remap/drop pattern, generated via `prisma migrate dev --create-only` and hand-edited (Prisma's raw diff would emit a plain `USING "type"::text::"AccountType"` cast, which fails for any row still holding `EVERYDAY`/`CASH` since those values won't exist in the new type):

```sql
ALTER TYPE "AccountType" RENAME TO "AccountType_old";

CREATE TYPE "AccountType" AS ENUM ('CHEQUE', 'SAVINGS', 'CREDIT_CARD', 'OTHER');

-- Remap existing data while switching the column to the new type:
-- EVERYDAY -> CHEQUE (same concept, renamed), CASH -> OTHER (no longer
-- a distinct type; this app's usage is digital-only).
ALTER TABLE "accounts"
  ALTER COLUMN "type" TYPE "AccountType"
  USING (
    CASE "type"::text
      WHEN 'EVERYDAY' THEN 'CHEQUE'
      WHEN 'CASH' THEN 'OTHER'
      ELSE "type"::text
    END
  )::"AccountType";

DROP TYPE "AccountType_old";
```

0c. **`packages/validation/src/account.ts`** — update `accountTypeSchema` to `z.enum(["CHEQUE", "SAVINGS", "CREDIT_CARD", "OTHER"])`.

0d. **Frontend chip lists** — both currently hardcode the old 5-value list with `"EVERYDAY"` as the default selected type:

- `apps/web/src/app/accounts/page.tsx:22,30` — `ACCOUNT_TYPES` array + `useState` default.
- `apps/mobile/app/(app)/accounts.tsx:23,31` — same shape.
  Update both arrays to the new 4-value list and default `useState` to `"CHEQUE"`.

0e. Before writing the real migration SQL, check actual row counts for `EVERYDAY`/`CASH` in the target database (`SELECT type, count(*) FROM accounts GROUP BY type;`) so the remap is verified against real data, not just assumed empty.

## Backend

1. **`apps/api/prisma/schema.prisma`** (`model User`, ~line 76-96) — add `onboardingCompletedAt DateTime?`.

2. **New migration** (`apps/api/prisma/migrations/<timestamp>_add_onboarding_completed_at/migration.sql`) — generate via `prisma migrate dev --create-only`, then hand-edit to add a backfill `UPDATE` so **existing users are never forced through onboarding retroactively**:

   ```sql
   ALTER TABLE "users" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
   -- Backfill: existing users have already effectively "onboarded" themselves.
   -- Backfilling to createdAt (not now()) avoids a misleading "all onboarded
   -- at the moment this migration ran" artifact if this field is ever surfaced.
   UPDATE "users" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;
   ```

   Prisma's diff engine only emits DDL, never data-mutating SQL — this `UPDATE` line must be added by hand, with a comment explaining why (no existing migration in this repo has a precedent for hand-added data migrations, per `apps/api/prisma/migrations/20260821223221_add_login_codes/migration.sql`). Confirmed via `docs/deployment.md` that production deploys run `prisma migrate deploy` directly with no separate backfill/hook step — so the backfill must live inside the migration file itself.

3. **`packages/types/src/auth.ts`** — add `onboardingCompletedAt: string | null;` to `AuthenticatedUser`.

4. **`apps/api/src/auth/auth.service.ts`**:
   - Add `onboardingCompletedAt: Date | null;` to the local `UserRecord` interface (line ~10-14), since `toAuthenticatedUser` reads off that type.
   - Update `toAuthenticatedUser()` (line ~168-170) to include `onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null`.
   - Add `completeOnboarding(userId: string): Promise<AuthenticatedUser>`, mirroring `getCurrentUser`'s shape (line ~151-154): `prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } })` then `toAuthenticatedUser(user)`.

5. **`apps/api/src/auth/auth.controller.ts`** — add, right after `me()` (line ~102-105):

   ```ts
   @Patch("onboarding")
   completeOnboarding(@CurrentUser() user: AccessTokenPayload): Promise<AuthenticatedUser> {
     return this.authService.completeOnboarding(user.sub);
   }
   ```

   No `@Public()` needed — `JwtAuthGuard` is global via `APP_GUARD`, and `me()` already relies on that same default with no explicit guard decorator. Import `Patch` from `@nestjs/common`.

6. **`apps/api/src/auth/auth.service.spec.ts`** — add a `completeOnboarding` test block, matching the style of the existing `getCurrentUser`/`login` blocks.

7. **`apps/api/test/auth.integration-spec.ts`** — add an integration test: register → assert `GET /auth/me` returns `onboardingCompletedAt: null` → `PATCH /auth/onboarding` → assert `GET /auth/me` now reflects a timestamp.

## Shared package

8. **`packages/api-client/src/client.ts`** — add `completeOnboarding()` as a method **on the `ApiClient` class itself**, not a new `resources/auth.ts` file — matches the existing pattern where `login`/`register`/`logout`/`restoreSession` all live on the class because of token-lifecycle side effects:

   ```ts
   async completeOnboarding(): Promise<AuthenticatedUser> {
     return this.request<AuthenticatedUser>("/auth/onboarding", { method: "PATCH" });
   }
   ```

## Frontend gate (centralized — one change per platform, not duplicated across every page)

Today, auth state (`apps/web/src/lib/auth-context.tsx` and `apps/mobile/lib/auth-context.tsx`, currently byte-identical files) has **no router/pathname awareness** — each of ~9 protected pages per platform independently redirects to `/login` when `!user`. Rather than duplicating an onboarding check into all ~18 of those pages, add it once to `auth-context.tsx` on each platform — the one place both platforms already share:

9. **`apps/web/src/lib/auth-context.tsx`**:
   - Import `useRouter`, `usePathname` from `next/navigation`.
   - Add an effect: when `!isLoading && user && !user.onboardingCompletedAt && pathname !== "/onboarding"` → `router.push("/onboarding")`.
   - Add `completeOnboarding(): Promise<void>` action to the context (mirrors `login`/`register`'s `setUser(await apiClient.X())` shape) so the onboarding page can clear the flag locally without a full reload.

10. **`apps/mobile/lib/auth-context.tsx`** — identical change, using `useRouter`/`usePathname` from `expo-router` (confirmed available — this repo targets Expo SDK 52+, which has `usePathname()`).

Note: this introduces router coupling into a file that has never had it before — a small architectural shift, but a strict improvement over the current 9x-duplicated redirect pattern. `register` pages on both platforms need **no changes** — they keep pushing to the dashboard as today; the new centralized gate immediately redirects a fresh user onward to `/onboarding` right after (a one-frame flash, consistent with how the existing `/login` redirect already behaves during the loading state).

## Onboarding screens (new, mirrored)

11. **`apps/web/src/app/onboarding/page.tsx`** (new) — local step state machine (no shared wizard component exists in this codebase — confirmed via repo-wide search; both apps build every multi-field flow with plain `useState` + inline try/catch around api-client calls, so a bespoke per-platform state machine matches existing convention rather than introducing a new abstraction):
    - On mount, call `listAccounts()`. If non-empty, skip straight to the **checklist** step (handles resuming after a partial previous session).
    - **Step "account"** (only if zero accounts, cannot be skipped): minimal create-account form — `name` + `type` chips (`CHEQUE`/`SAVINGS`/`CREDIT_CARD`/`OTHER`, see "Account Type Enum Change" above; default `CHEQUE`) only (currency defaults `"NZD"` in the schema). On submit → advance to checklist.
    - **Step "checklist"**: "Want to set up anything else? You can always do this later." — three checkboxes — "A monthly budget", "Upcoming bills", "A savings goal" — plus "Continue" and a top-level _Skip for now_ link that jumps straight to finish.
    - **Step "detail-<entity>"**, shown one at a time for each checked box, each with its own "Skip this" link:
      - Budget: `period` + `totalAmountMinorUnits` only (overall mode — omit `categoryAllocations` entirely, not `[]`; `createBudgetSchema`'s `superRefine` XOR requires exactly one of the two, see `packages/validation/src/budget.ts:19-51`).
      - Bill: `name`, `amountMinorUnits`, `recurrence`, `firstDueDate` (default today).
      - Goal: `name`, `targetAmountMinorUnits`.
      - All four schemas default `currency` to `"NZD"` — omit it everywhere, consistent with every existing create-form in the repo.
    - **Finish**: call `completeOnboarding()` from `useAuth()`, then `router.push("/dashboard")`.
    - Reuse existing local components (`AppShell`, `Button`, `Field`/`Input`, `Section`) and existing `createAccount`/`createBudget`/`createBill`/`createGoal` from `@budget-terry/api-client` — no new UI primitives.

12. **`apps/mobile/app/onboarding.tsx`** (new) — sibling to `login.tsx`/`register.tsx` (i.e. **outside** the `(app)/` drawer group, same convention those two already use), identical state machine, reusing `Screen`, `Button`, `TextField`, `Section` from `apps/mobile/components/`.

## Docs

13. **`README.md`** — add a "Concepts" section (near "Architecture Summary", matching the existing `##` heading style): accounts hold the real money; categories label what a transaction is for; budgets are a category+period spending target compared against transactions; bills forecast recurring outflows and optionally draw from an account when paid; goals track savings and optionally draw contributions from an account.

## Resolved

- Checklist copy and skip-link wording: settled above.
- Account types: trimmed to `CHEQUE`/`SAVINGS`/`CREDIT_CARD`/`OTHER` (see "Account Type Enum Change") — more can be added later if actually needed, rather than guessing at a bigger list up front.
- No dedicated ADR — the router-coupling change in `auth-context.tsx` is cheap to revisit later, unlike the tradeoffs existing ADRs document; a code comment explaining the reasoning is enough.

## Verification

- `pnpm --filter @budget-terry/api run test` (unit) and integration tests after the backend changes.
- Apply the migrations locally (`prisma migrate dev`) against the Docker Postgres instance; manually inspect that existing seeded users get backfilled `onboardingCompletedAt` while a freshly registered user gets `null`, and that any pre-existing `EVERYDAY`/`CASH` accounts landed on `CHEQUE`/`OTHER` respectively with no rows lost.
- Before running the enum migration against production, check real row counts per `type` value (see "Account Type Enum Change" step 0e) so the remap is verified against actual data.
- Web: register a brand-new account in the browser, confirm the `/onboarding` redirect fires, walk both the mandatory account step and the skippable checklist (test both "skip everything" and "fill in one item" paths), confirm landing on `/dashboard` and that reloading afterward does not re-trigger onboarding.
- Mobile: same walkthrough on the already-connected physical device/emulator, plus confirm an **existing** logged-in user (already has accounts, migration-backfilled) does _not_ get redirected into onboarding.
- `pnpm quality` (typecheck/lint/test) across affected workspaces; `npx expo export` for both mobile platforms per this project's established mobile verification method.
