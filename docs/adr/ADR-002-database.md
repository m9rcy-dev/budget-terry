# ADR-002: Database Engine and Money Representation

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Section 16) mandates PostgreSQL and requires money never be stored as floating point. Given the hobby-app scale, SQLite was proposed as a lighter alternative to avoid what felt like unnecessary "enterprise" weight.

Evaluating that trade-off: with a managed free-tier provider (see ADR-009), Postgres requires no more setup than SQLite — both amount to a single connection string. SQLite, however, carries real costs specific to this project: Prisma's SQLite connector cannot perform many `ALTER TABLE` operations natively and instead rebuilds tables, which is fragile across the plan's 14 planned schema-evolving phases; the plan's own testing strategy (Section 31) assumes Testcontainers against real Postgres; SQLite is a file, requiring persistent-disk hosting and ruling out serverless deploy targets later; and SQLite's single-writer lock becomes a real constraint once multi-user support is switched on (already designed for — see ADR-003).

## Decision

Use **PostgreSQL** as the only database engine, for both local development and production. Store money as **integer minor units** (e.g. cents) — never as floating point, and never as a string requiring runtime decimal parsing at API boundaries. Currency is stored explicitly per relevant record (account/transaction), defaulting to NZD, with no multi-currency conversion in MVP (plan Section 52).

## Consequences

- Real concurrent-write support is available from day one, ready for the planned future switch to multi-user (ADR-003).
- The plan's Testcontainers-based integration testing strategy works as written, with no gap between test and production database engines.
- Any logic that splits a monetary total across multiple shares (payday contributions, percentage-based budget allocation) must account for the fact that integer minor units don't divide evenly — handled by a shared allocation utility (ADR-007), not per-feature rounding.
- See ADR-009 for _where_ Postgres runs (Neon for production, local Docker for development).

## Alternatives Considered

- **SQLite** — rejected; see Context above.
- **DECIMAL/NUMERIC columns instead of integer minor units** — a valid alternative (the plan allows either, so long as it's never float). Integer minor units were chosen for simplicity across TypeScript/JSON serialization boundaries, avoiding decimal-string parsing bugs in API payloads.
