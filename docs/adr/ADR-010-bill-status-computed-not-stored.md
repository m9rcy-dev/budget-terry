# ADR-010: Bill Occurrence Status Is Computed, Not Stored

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Section 5) lists six bill statuses: `UPCOMING`, `DUE_SOON`, `DUE_TODAY`, `OVERDUE`, `PAID`, `SKIPPED`. Naively storing all six as a single persisted column on `BillOccurrence` is a classic staleness trap: `UPCOMING`/`DUE_SOON`/`DUE_TODAY`/`OVERDUE` are all _relative to today's date_, not to any user action. A bill occurrence due yesterday and stored as `DUE_TODAY` yesterday does not become `OVERDUE` today unless something explicitly re-computes and rewrites that row — which means either a nightly batch job (added complexity, another way for data to be wrong if it fails to run) or the field silently drifts out of sync with reality.

`PAID` and `SKIPPED`, in contrast, are genuine user actions with no time-relativity — once set, they don't need to change based on the passage of time.

## Decision

`BillOccurrence.paymentStatus` persists only the real, user-driven states: `PENDING`, `PAID`, `SKIPPED`. The time-relative display statuses (`UPCOMING`, `DUE_SOON`, `DUE_TODAY`, `OVERDUE`) are **computed at read time** by the API layer, comparing `dueDate` to the current date whenever a bill list/calendar/dashboard response is built — never written to the database.

## Consequences

- No batch job is needed to keep bill statuses accurate; correctness follows automatically from comparing `dueDate` to "now" at request time.
- The API's bill response DTO (introduced in Phase 8) is responsible for mapping `paymentStatus` + `dueDate` to the full six-state status the plan's UI expects — this mapping logic needs its own unit tests (e.g., "a PENDING occurrence due yesterday reports OVERDUE", "a PENDING occurrence due in 3 days reports DUE_SOON" once the exact DUE_SOON threshold is decided).
- The exact boundary for `DUE_SOON` (how many days out) isn't decided by this ADR — that's a product/UX decision for Phase 8, not a schema concern.

## Alternatives Considered

- **Store all six statuses directly** — rejected: requires a recurring job to keep time-relative values correct, and any gap in that job (deploy issue, missed run) silently shows wrong data to the user on a screen whose entire purpose is trustworthy financial information (plan Section 1).
