# ADR-003: Authentication Strategy for MVP

**Status:** Accepted
**Date:** 2026-08-14

## Context

Budget Terry V2 is currently intended for single-user (personal) use, but the plan explicitly wants it to be easy to switch to multi-user later without a disruptive rework. If user-scoping is omitted from the schema now and added later, every existing table would need a backfill migration with no reliable way to determine which rows belong to which user — a risky, error-prone retrofit for financial data.

## Decision

No login, registration, or session UI is built for MVP. Instead, every domain table (`Transaction`, `Account`, `Category`, `Budget`, `Bill`, `BillOccurrence`, `SavingsGoal`, `GoalContribution`) has a **required `userId` foreign key from the very first migration**. A single seeded system user is used everywhere a real authenticated user would eventually be resolved from an auth guard. Real authentication (email + password initially, with passkeys/Apple/Google sign-in as later options per plan Section 20) is added in a later phase purely by introducing real auth middleware/guards that resolve the actual current user — no schema change required at that point.

## Consequences

- Multi-user support becomes an additive feature (add auth, add authorization checks) rather than a data migration project.
- MVP ships faster without building/testing full auth flows now.
- Every future query and service method must already be written as if `userId` scoping matters (i.e., always filter by the current user), even though there's only one user today — this is what makes the later auth switch safe.
- Authorization isolation tests ("user A cannot access user B's data" — plan Section 39, 3, Phase 3) are deferred until real authentication exists, but are required before multi-user support ships.

## Alternatives Considered

- **Omit `userId` for MVP, add it later** — rejected: requires a risky backfill migration with no reliable way to assign historical rows to users.
- **Build full authentication now** — rejected: unnecessary complexity and time cost for a currently single-user hobby application; the auth-ready schema captures the same future flexibility at a fraction of the effort.
