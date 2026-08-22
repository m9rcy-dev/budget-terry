import { addUtcDays, addUtcMonthsClamped } from "../common/date-utils";

export type BillRecurrenceType =
  "ONE_OFF" | "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export type BillDisplayStatus =
  "UPCOMING" | "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | "PAID" | "SKIPPED";

/**
 * How far ahead (in days) occurrences are generated / topped up. ADR-010
 * deliberately left this open as a Phase 8 product decision, not a
 * schema concern — 90 days keeps a bill's near-term future populated
 * without generating years of rows for a bill that's rarely revisited.
 */
export const OCCURRENCE_HORIZON_DAYS = 90;

/**
 * Also left open by ADR-010: how many days out counts as "due soon"
 * rather than merely "upcoming". A week gives enough lead time to act
 * without flagging everything in the horizon as urgent.
 */
const DUE_SOON_WINDOW_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STEP_DAYS: Partial<Record<BillRecurrenceType, number>> = {
  WEEKLY: 7,
  FORTNIGHTLY: 14,
};
const STEP_MONTHS: Partial<Record<BillRecurrenceType, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

export function nextDueDate(recurrence: BillRecurrenceType, current: Date): Date {
  const stepDays = STEP_DAYS[recurrence];
  if (stepDays !== undefined) {
    return addUtcDays(current, stepDays);
  }
  const stepMonths = STEP_MONTHS[recurrence];
  if (stepMonths !== undefined) {
    return addUtcMonthsClamped(current, stepMonths);
  }
  throw new Error("ONE_OFF bills do not recur.");
}

/**
 * Generates due dates starting at `from` — always included, even if
 * beyond `horizonEnd`, since it's the date the caller explicitly asked
 * for (a bill's chosen first due date, or the next date after topping
 * up an existing series) — through `horizonEnd` inclusive. ONE_OFF bills
 * always produce exactly `[from]`. Capped at a fixed iteration count as
 * a defensive guard against an infinite loop from a future recurrence-
 * type bug.
 */
export function generateOccurrenceDates(
  recurrence: BillRecurrenceType,
  from: Date,
  horizonEnd: Date,
): Date[] {
  if (recurrence === "ONE_OFF") {
    return [from];
  }

  const dates: Date[] = [from];
  let current = from;
  const MAX_ITERATIONS = 500;
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const next = nextDueDate(recurrence, current);
    if (next.getTime() > horizonEnd.getTime()) {
      break;
    }
    dates.push(next);
    current = next;
  }
  return dates;
}

/**
 * Maps stored paymentStatus + dueDate to the plan's six-state display
 * status (plan Section 5, ADR-010). PAID/SKIPPED pass through unchanged
 * since they're genuine user actions with no time-relativity; PENDING is
 * further split by comparing dueDate to `today`.
 */
export function computeDisplayStatus(
  paymentStatus: "PENDING" | "PAID" | "SKIPPED",
  dueDate: Date,
  today: Date,
): BillDisplayStatus {
  if (paymentStatus === "PAID" || paymentStatus === "SKIPPED") {
    return paymentStatus;
  }

  const dueMidnight = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate(),
  );
  const todayMidnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const diffDays = Math.round((dueMidnight - todayMidnight) / MS_PER_DAY);

  if (diffDays < 0) {
    return "OVERDUE";
  }
  if (diffDays === 0) {
    return "DUE_TODAY";
  }
  if (diffDays <= DUE_SOON_WINDOW_DAYS) {
    return "DUE_SOON";
  }
  return "UPCOMING";
}
