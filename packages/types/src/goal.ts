import type { CurrencyCode } from "./money";

export type GoalStatusType = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface GoalContribution {
  id: string;
  goalId: string;
  amountMinorUnits: number;
  currency: CurrencyCode;
  contributionDate: string;
  notes: string | null;
  relatedTransactionId: string | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountMinorUnits: number;
  currency: CurrencyCode;
  targetDate: string | null;
  accountId: string | null;
  notes: string | null;
  status: GoalStatusType;
  savedMinorUnits: number;
  remainingMinorUnits: number;
  percentageComplete: number;
  /**
   * Null when there's no targetDate to compute against. See
   * apps/api/src/goals/goal-progress.ts for how this is derived — it's a
   * suggestion (plan Section 8's "Suggested contribution"), not a stored
   * rule; recurring/automated payday contributions are deliberately out
   * of scope for this phase (no payday/recurring-income entity exists —
   * same open decision noted for the Phase 9 calendar's income entries).
   */
  suggestedMonthlyContributionMinorUnits: number | null;
  contributions: GoalContribution[];
}
