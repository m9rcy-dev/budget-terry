# ADR-008: Category and Account Lifecycle — Archive vs Hard Delete

**Status:** Accepted
**Date:** 2026-08-14

## Context

The base plan specifies that accounts are archived rather than deleted, but says nothing about categories. Deleting a category or account that has transaction history attached would either break the foreign-key reference on those transactions, or silently strip meaningful data (the category/account label) from past reports — corrupting previously-correct historical data.

## Decision

Categories and accounts may be **hard-deleted only if they have zero transactions referencing them**. Once any transaction references a category or account, it becomes **archive-only**: hidden from pickers for new entries, but fully preserved (with history and label intact) on all existing transactions, budgets, and reports. **Renaming** a category or account is always permitted regardless of transaction history, since it doesn't affect referential integrity — a rename simply changes the label future and past transactions display.

## Consequences

- Historical reports never retroactively change or break due to later cleanup actions (deleting an unused category, archiving an old account).
- UI needs an explicit "archived" state/filter for category and account pickers and management screens, distinct from the normal active list.
- A category or account created by mistake and never used can still be cleanly removed, rather than accumulating permanently-archived clutter.

## Alternatives Considered

- **Always archive, never hard-delete** — rejected as unnecessarily restrictive for genuinely-unused categories/accounts with no history to protect.
- **Allow hard delete regardless of history** — rejected: breaks historical report integrity, the core failure mode this ADR exists to prevent.
