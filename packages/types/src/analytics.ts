import type { BillRecurrenceType } from "./bill";
import type { Budget } from "./budget";
import type { SavingsGoal } from "./goal";
import type { CategoryTotal } from "./transaction";

/** `month` is `YYYY-MM`. Sparse — only months with at least one transaction are included. */
export interface SpendingByMonthEntry {
  month: string;
  totalMinorUnits: number;
}

export interface IncomeVsExpensesEntry {
  month: string;
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  netMinorUnits: number;
}

export interface SavingsContributionsSummary {
  totalMinorUnits: number;
  byGoal: { goalId: string; goalName: string; totalMinorUnits: number }[];
}

/** A snapshot of currently-ACTIVE goals — not scoped to the query's date range. */
export interface GoalProgressSummary {
  totalSavedMinorUnits: number;
  totalTargetMinorUnits: number;
  overallPercentage: number;
  goals: SavingsGoal[];
}

/** Non-ONE_OFF bills only — a one-off bill has no "recurring" monthly cost to summarize. */
export interface RecurringExpenseSummaryEntry {
  billId: string;
  name: string;
  recurrence: BillRecurrenceType;
  amountMinorUnits: number;
  monthlyEquivalentMinorUnits: number;
}

/**
 * Composes existing report-scoped services (Transactions, Budgets, Bills,
 * Goals) rather than a new dedicated data model — same "one call, many
 * sections" shape as DashboardSummary/CalendarEntry. `spendingByCategory`,
 * `spendingByMonth`, `incomeVsExpenses`, and `highestExpenseCategories` are
 * scoped to `period`; `budgetVsActual`, `goalProgress`, and
 * `recurringExpenseSummary` are current-state snapshots that ignore it —
 * a budget's "actual" is always its current period, not an arbitrary past
 * range (see ADR-006).
 */
export interface AnalyticsSummary {
  period: { from: string; to: string };
  spendingByCategory: CategoryTotal[];
  spendingByMonth: SpendingByMonthEntry[];
  incomeVsExpenses: IncomeVsExpensesEntry[];
  budgetVsActual: Budget[];
  savingsContributions: SavingsContributionsSummary;
  goalProgress: GoalProgressSummary;
  recurringExpenseSummary: RecurringExpenseSummaryEntry[];
  highestExpenseCategories: CategoryTotal[];
}
