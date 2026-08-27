# Dashboard: Upcoming Bills Insight

**Status:** Draft — under review
**Date:** 2026-08-26

## Context

The dashboard currently only summarizes the past/current period (income, expenses, net, recent transactions) — nothing forward-looking. The most useful "what's coming" signal already exists in the data model: bill occurrences with due dates. This surfaces bills due soon directly on the dashboard instead of requiring a trip to Bills or Calendar.

## Decision

Reuse `BillsService.findOccurrencesDueInRange` (`apps/api/src/bills/bills.service.ts:298-319`) — already used by the calendar feature, already returns exactly the right shape (`BillOccurrenceForCalendar[]`: id, name, due date, amount, computed display status). Reuse the existing `DUE_SOON_WINDOW_DAYS = 7` constant (`apps/api/src/bills/bill-recurrence.ts:22`) as the dashboard's window too, rather than inventing a second "how many days ahead" number — "due soon" already means the same thing everywhere else in the product (calendar, bill list status dots).

Only `PENDING` occurrences are shown (already paid/skipped bills aren't "upcoming"). Sorted by due date ascending, capped at a small count (5, matching `RECENT_TRANSACTIONS_COUNT`'s existing precedent for "keep the dashboard skimmable").

## Backend

1. **`apps/api/src/dashboard/dashboard.service.ts`**:
   - Inject `BillsService`.
   - In `getSummary`, add a parallel call: `this.billsService.findOccurrencesDueInRange(userId, today, addDays(today, DUE_SOON_WINDOW_DAYS))`, filter to `paymentStatus === "PENDING"` (note: `findOccurrencesDueInRange` doesn't filter payment status today — either add an optional filter param there, or filter client-side in `DashboardService` after the call; filtering in the service call is cleaner and reusable), sort ascending, slice to 5.
   - Add `upcomingBills: BillOccurrenceForCalendar[]` to `DashboardSummary`.
   - `DUE_SOON_WINDOW_DAYS` needs exporting from `bill-recurrence.ts` (currently module-private) so `DashboardService` can reuse it rather than duplicating the literal `7`.

2. **`apps/api/src/dashboard/dashboard.module.ts`** — import `BillsModule` (or export `BillsService` from it) so it's injectable here.

3. **`packages/types/src/dashboard.ts`** — mirror the same `upcomingBills` field addition (this file duplicates the shape independently from `apps/api/src/dashboard/dashboard.service.ts`'s own `DashboardSummary` interface, same duplication pattern already seen with `AccountType` — both need updating).

## Frontend (web + mobile)

4. **`apps/web/src/app/dashboard/page.tsx`** — new `Section title="Upcoming bills"` between the summary card and recent transactions, listing name/due date/amount, empty state "Nothing due in the next 7 days." when the array is empty. No actions (Pay/Skip) here — this is a glance view; clicking through to Bills/Calendar for action is enough scope for this pass.

5. **`apps/mobile/app/(app)/index.tsx`** — same section, mirrored, reusing `EmptyState`/`Section` components already imported there.

## Verification

- Unit test on `DashboardService` (new `dashboard.service.spec.ts` block or extend existing): bills due within 7 days appear, bills due in 8+ days don't, PAID/SKIPPED occurrences are excluded.
- Integration test extension on `dashboard.integration-spec.ts`: create a bill due tomorrow, assert it appears in `GET /dashboard/summary`'s `upcomingBills`.
- Manual: web + mobile dashboard both render the new section against real local data (an account with a bill due within a week).
- `pnpm quality`.
