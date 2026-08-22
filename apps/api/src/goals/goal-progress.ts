/**
 * Whole months between `today` and `targetDate`, clamped to a minimum of
 * 1 — a target date this month or already passed still returns a
 * concrete "put this in now" figure rather than null/Infinity. A target
 * date isn't reached until its day-of-month is reached, so a partial
 * final month still counts as needing this month's contribution (e.g.
 * today = Aug 20, target = Sep 5 is only 16 days away but still needs an
 * August contribution to stay on track, not zero months).
 */
export function computeMonthsRemaining(today: Date, targetDate: Date): number {
  let months =
    (targetDate.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (targetDate.getUTCMonth() - today.getUTCMonth());
  if (targetDate.getUTCDate() < today.getUTCDate()) {
    months -= 1;
  }
  return Math.max(1, months);
}

/**
 * Rounds up so the suggestion never under-shoots the target — plan
 * Section 8's "Suggested contribution", not a stored/recurring rule (see
 * the comment on SavingsGoal.suggestedMonthlyContributionMinorUnits in
 * packages/types/src/goal.ts for why automated payday rules are
 * deliberately out of scope this phase).
 */
export function computeSuggestedMonthlyContribution(
  remainingMinorUnits: number,
  monthsRemaining: number,
): number {
  if (remainingMinorUnits <= 0) {
    return 0;
  }
  return Math.ceil(remainingMinorUnits / monthsRemaining);
}
