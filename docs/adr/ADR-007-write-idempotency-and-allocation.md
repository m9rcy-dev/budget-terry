# ADR-007: Write Idempotency and Split Allocation

**Status:** Accepted
**Date:** 2026-08-14

## Context

Two related money-correctness gaps are not addressed by the base plan:

1. Mutating requests (add expense, add income, add goal contribution) can be duplicated by network retries or double-taps, especially on mobile — producing two genuinely identical-looking transactions with nothing to distinguish a duplicate from a real second entry.
2. Splitting an integer-minor-units total across multiple shares (payday contribution allocation, percentage-based budget category allocation — see ADR-002 for why money is integer minor units) does not divide evenly, and naive per-share rounding can make the parts not sum exactly to the whole.

## Decision

**(a) Idempotency:** create endpoints accept an optional `Idempotency-Key` header. The server persists it against the created resource (a unique constraint on `(userId, idempotencyKey)` in Postgres is sufficient — no separate cache/store needed at this scale) and returns the original resource on replay instead of creating a duplicate. This starts with Phase 5 (transactions), not deferred to a future offline-sync phase. State-transition endpoints (mark bill paid/skipped) are made idempotent by construction — checking current status before acting — rather than requiring a key.

**(b) Split allocation:** all money-splitting logic (payday contribution allocation, percentage-based budget allocation) uses a single shared `allocate(totalMinorUnits, weights[])` utility in the domain package, implementing **largest-remainder allocation**: compute each share's exact fractional amount, floor it, then distribute the leftover minor units one-by-one to the shares with the largest fractional remainder, so the parts always sum exactly to the total.

## Consequences

- No duplicate transactions from retried mutating requests, on web or mobile.
- No "missing or extra cent" bugs in payday contribution splitting or percentage-based budget allocation.
- `allocate()` is implemented once, thoroughly unit-tested, and reused everywhere a monetary total is split — never reimplemented per feature (Section 25's "do not duplicate domain rules" rule applies directly here).

## Alternatives Considered

- **Deferring idempotency to the later offline-sync phase**, as the base plan implied (Section 56) — rejected: mobile network retries and double-taps are a problem today, independent of whether full offline support is ever built.
- **Per-feature rounding logic** — rejected: risks inconsistent rounding behavior across features and violates the shared-domain-rule principle.
