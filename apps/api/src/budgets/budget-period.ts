import { addUtcDays, addUtcMonthsClamped } from "../common/date-utils";

export type BudgetPeriodType = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export interface PeriodRange {
  /** Inclusive, UTC midnight. */
  start: Date;
  /** Inclusive, UTC midnight. */
  end: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERIOD_LENGTH_DAYS: Record<"WEEKLY" | "FORTNIGHTLY", number> = {
  WEEKLY: 7,
  FORTNIGHTLY: 14,
};

/**
 * Computes the [start, end] of the budget period containing
 * `referenceDate`, walking forward (or backward) from `anchorDate` in
 * fixed steps — never aligned to the calendar month. See ADR-006.
 *
 * Dates are handled entirely in UTC to avoid daylight-saving-time
 * shifts affecting period boundaries; per-user timezone handling is a
 * future refinement (plan Section 51), not part of this calculation.
 */
export function computeCurrentPeriod(
  period: BudgetPeriodType,
  anchorDate: Date,
  referenceDate: Date,
): PeriodRange {
  if (period === "WEEKLY" || period === "FORTNIGHTLY") {
    const lengthDays = PERIOD_LENGTH_DAYS[period];
    const diffDays = Math.floor((referenceDate.getTime() - anchorDate.getTime()) / MS_PER_DAY);
    const periodIndex = Math.floor(diffDays / lengthDays);
    const start = addUtcDays(anchorDate, periodIndex * lengthDays);
    const end = addUtcDays(start, lengthDays - 1);
    return { start, end };
  }

  // MONTHLY — integer month arithmetic directly from the anchor, so
  // there's no iterative drift the way repeatedly adding ~30 days would
  // accumulate.
  let monthsDiff =
    (referenceDate.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 +
    (referenceDate.getUTCMonth() - anchorDate.getUTCMonth());

  let start = addUtcMonthsClamped(anchorDate, monthsDiff);
  if (start.getTime() > referenceDate.getTime()) {
    monthsDiff -= 1;
    start = addUtcMonthsClamped(anchorDate, monthsDiff);
  }

  const nextStart = addUtcMonthsClamped(anchorDate, monthsDiff + 1);
  const end = addUtcDays(nextStart, -1);
  return { start, end };
}
