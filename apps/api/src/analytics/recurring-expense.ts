import type { BillRecurrenceType } from "@budget-terry/types";

const ANNUAL_OCCURRENCES: Partial<Record<BillRecurrenceType, number>> = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  YEARLY: 1,
};

/**
 * Converts a bill's per-occurrence amount into a monthly-equivalent cost
 * so recurring commitments on different schedules can be compared and
 * summed directly (plan Section 10's "Recurring expense summary").
 * ONE_OFF has no recurring cadence — callers filter it out before
 * calling this (see AnalyticsService).
 */
export function monthlyEquivalent(
  amountMinorUnits: number,
  recurrence: BillRecurrenceType,
): number {
  const occurrencesPerYear = ANNUAL_OCCURRENCES[recurrence];
  if (!occurrencesPerYear) {
    throw new Error("ONE_OFF bills have no monthly-equivalent recurring cost.");
  }
  return Math.round((amountMinorUnits * occurrencesPerYear) / 12);
}
