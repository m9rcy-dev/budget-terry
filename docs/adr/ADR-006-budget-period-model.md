# ADR-006: Budget Period Model

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Section 4) lists weekly/fortnightly/monthly as supported budget periods, and Section 9's dashboard language assumes calendar-month periods ("Current month", "Previous month"). In practice, budget periods should follow when income actually arrives — salary is often paid fortnightly and does not align to calendar month boundaries.

## Decision

`Budget.period` is one of `WEEKLY` / `FORTNIGHTLY` / `MONTHLY`, paired with `Budget.anchorDate` (the first period start date, typically the user's payday). Period boundaries are computed by walking forward from the anchor in fixed-length steps rather than aligning to calendar months.

## Consequences

- Dashboard/report language (plan Section 9) should read "current period / previous period" rather than "current month / previous month" once implemented, since periods may not be calendar-month-aligned.
- Date-boundary unit tests must cover arbitrary anchor dates, not just calendar month starts — extending the month-boundary/DST testing the plan already calls for in Section 51.

## Alternatives Considered

- **Calendar-month-only budgets** — rejected: doesn't match how salary/payday cycles actually work for fortnightly or weekly-paid users.
- **A separate `PayCycle` entity that auto-generates budget periods from income recurrence** — deferred, not rejected. `anchorDate` + `period` is sufficient for MVP; a `PayCycle` concept could be introduced later if auto-suggesting periods from recorded income recurrence becomes valuable.
