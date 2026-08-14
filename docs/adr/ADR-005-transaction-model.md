# ADR-005: Transaction Model — Bills and Goals as Linked Transactions

**Status:** Accepted
**Date:** 2026-08-14

## Context

The plan (Section 17) lists `Bill`/`BillOccurrence` and `SavingsGoal`/`GoalContribution` as entities separate from `Transaction`, but never states whether actions on them (marking a bill paid, recording a goal contribution) affect the transaction ledger. Left unresolved, a paid bill or a goal contribution would not appear in transaction history, dashboard totals, or category spending reports unless the user separately re-entered it as an expense — risking silently incorrect answers to "where did my money go?", which is the product's core value proposition (plan Section 1).

## Decision

Marking a `BillOccurrence` as `PAID` and recording a `GoalContribution` each **atomically create a linked `Transaction` row** (`Transaction.relatedBillOccurrenceId`, `Transaction.relatedGoalContributionId` — nullable FKs). `Transaction` remains the single source of truth for all money-movement reporting: dashboard totals, category spend, account balances. `Bill` and `Goal` entities keep their own domain-specific fields (due dates, recurrence, target amount/progress) but do not duplicate ledger responsibility.

## Consequences

- Dashboard and report queries only ever need to read `Transaction` — no need to union across `Bill`/`Goal`/`Transaction` tables to compute correct totals.
- Marking a bill paid or adding a contribution must be implemented as a single atomic operation (status update + transaction creation together) so a partial failure never leaves the bill/goal state and the transaction ledger inconsistent.
- Combined with idempotency (ADR-007), this also means "mark bill paid" must be safe to call twice without creating a second linked transaction — checked via current status before acting.

## Alternatives Considered

- **Keeping Bill/Goal payments as separate ledgers from `Transaction`** — rejected: creates reconciliation risk and requires every report to be aware of three data sources instead of one, contradicting the "useful information over raw data" product principle (plan Section 2.2).
