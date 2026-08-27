# Goals: Progress Graph

**Status:** Approved — ready to implement
**Date:** 2026-08-26

## Context

Goals currently show a thin linear progress bar plus a percentage and a "$X of $Y" line. The ask is a more visual "how much is left" view — the API already computes everything needed (`savedMinorUnits`, `remainingMinorUnits`, `percentageComplete` — `packages/types/src/goal.ts:17-32`), this is purely a presentation change, no backend work.

## Decision

A **radial progress ring** (a filled arc showing percentage complete, with the dollar amount remaining as the prominent center label) rather than a bar chart or historical trend line — it directly answers "how much is left," matches the common savings-goal visual pattern (a "fuel gauge"), and works identically well for a single goal card on both platforms.

Build it as a small custom SVG component on each platform rather than pulling in a charting library:

- **Mobile has no charting library today** (`apps/mobile/package.json` has `react-native-svg` only, confirmed — no `victory-native`/`react-native-chart-kit`/Skia). A ring is a handful of `<Circle>` elements with `strokeDasharray`/`strokeDashoffset` — react-native-svg already covers this, no new dependency needed.
- **Web has `recharts`** (used on the Analytics page), which could do a `RadialBarChart`, but a hand-built SVG ring is ~30 lines, avoids pulling recharts into a page that doesn't otherwise use it, and keeps the visual identical to mobile's version (same "different mechanism, same visual language" precedent already established for tokens — `packages/ui/src/tokens.ts`'s own docstring).

Decided: the ring **replaces the linear bar everywhere** — one visual instead of two, no separate compact/expanded split. Each goal card also gets a **contribution history** mini bar-chart (confirmed in scope) — the data's already there (`contributions: GoalContribution[]` per goal, `packages/types/src/goal.ts:29`), no backend work needed. Same hand-rolled-SVG approach as the ring: one bar per contribution (date below, amount as bar height), most recent 8 shown, oldest-first left-to-right. Lives directly in the goal card beneath the ring — this app doesn't have per-item detail routes anywhere else (bills/budgets are all single-list-page-with-inline-cards too), so a history chart tucked into an expand/accordion would be the first of its kind; keeping it always-visible in the card matches how every other entity already works here.

## Shared visual spec

- Ring: percentage arc in `colors.accentPrimary`, remainder in `colors.border` (or a light track color), rounded line caps.
- Center label: `$X remaining` (not "$X of $Y" — the ask was specifically "how much left," so lead with that number), percentage as a smaller secondary line.
- Goal `status !== "ACTIVE"` (completed/archived) still renders the ring at 100%/final state, no special-casing needed beyond what already exists.

## Frontend (web + mobile)

1. **New `apps/web/src/components/GoalProgressRing.tsx`** — props `{ percentageComplete: number; remainingMinorUnits: number; currency }`, pure SVG, no external deps beyond React.
2. **New `apps/mobile/components/GoalProgressRing.tsx`** — same props, built on `react-native-svg`'s `Svg`/`Circle`.
3. **New `apps/web/src/components/GoalContributionHistory.tsx`** — props `{ contributions: GoalContribution[]; currency }`, a small bar chart: SVG `<rect>` per contribution, height proportional to `amountMinorUnits` (scaled to the max in the set), x-axis label = `contributionDate` (short format), empty state ("No contributions yet.") when the array is empty.
4. **New `apps/mobile/components/GoalContributionHistory.tsx`** — same props/logic, `react-native-svg` `Rect` elements.
5. **`apps/web/src/app/goals/page.tsx`** / **`apps/mobile/app/(app)/goals.tsx`** — remove the existing `StatusBar`-style linear bar entirely; each goal card renders `GoalProgressRing` then `GoalContributionHistory` beneath it.

## Verification

- Visual check both platforms at 0%, ~50%, 100%, and a completed/archived goal, plus a goal with 0, 1, and 8+ contributions (chart scaling and empty state).
- `pnpm quality` (typecheck/lint/test — no new backend logic, so no new integration tests needed).
