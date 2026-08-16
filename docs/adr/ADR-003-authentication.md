# ADR-003: Authentication Strategy for MVP

**Status:** Accepted (revised 2026-08-15 — see Revision below)
**Date:** 2026-08-14

## Context

Budget Terry V2 is currently intended for single-user (personal) use, but the plan explicitly wants it to be easy to switch to multi-user later without a disruptive rework. If user-scoping is omitted from the schema now and added later, every existing table would need a backfill migration with no reliable way to determine which rows belong to which user — a risky, error-prone retrofit for financial data.

## Decision

Every domain table (`Transaction`, `Account`, `Category`, `Budget`, `Bill`, `BillOccurrence`, `SavingsGoal`, `GoalContribution`) has a **required `userId` foreign key from the very first migration**. This part of the decision is unchanged by the revision below — it's what makes real auth an additive Phase 3 feature rather than a schema migration.

~~No login, registration, or session UI is built for MVP. ... A single seeded system user is used everywhere a real authenticated user would eventually be resolved from an auth guard.~~ — **superseded, see Revision.**

## Revision (2026-08-15)

The original decision deferred building real authentication for MVP. That's reversed: **real register/login/logout/refresh is built now, in Phase 3**, not deferred. Session/token mechanics (JWT access token, opaque rotating refresh token, argon2id password hashing, Bearer transport on both web and mobile) are specified in **ADR-011**.

The seeded-system-user mechanism this ADR originally described is retired as a request-scoping mechanism — "current user" is now resolved from a verified JWT via the auth guard, not a hardcoded id. The old seed script is repurposed as a local-dev convenience (creates one documented dev account with a known password) rather than a production code path.

The `userId`-on-every-table schema decision above is exactly what made this reversal cheap: no migration was needed to support real auth, only additive changes (`User.passwordHash`, a new `RefreshToken` table).

## Consequences

- Multi-user support was already additive by design (this ADR's core schema decision) and is now actually exercised by real per-user scoping in every guarded endpoint, not just designed for.
- Authorization isolation tests ("user A cannot access user B's data" — plan Section 39, Phase 3) are written now, as part of Phase 3, against real registered users — see ADR-011 and `docs/architecture/security.md`.

## Alternatives Considered

- **Omit `userId` for MVP, add it later** — rejected: requires a risky backfill migration with no reliable way to assign historical rows to users.
- **Continue deferring full authentication** — reconsidered and reversed 2026-08-15; see Revision above.
