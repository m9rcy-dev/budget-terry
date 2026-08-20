import { Injectable } from "@nestjs/common";
import type { AnalyticsQuery } from "@budget-terry/validation";
import { BillsService, type BillWithStatus } from "../bills/bills.service";
import { BudgetsService, type BudgetWithStatus } from "../budgets/budgets.service";
import { GoalsService, type GoalWithProgress } from "../goals/goals.service";
import { TransactionsService, type CategoryTotal } from "../transactions/transactions.service";
import { monthlyEquivalent } from "./recurring-expense";

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

export interface GoalProgressSummary {
  totalSavedMinorUnits: number;
  totalTargetMinorUnits: number;
  overallPercentage: number;
  goals: GoalWithProgress[];
}

export interface RecurringExpenseSummaryEntry {
  billId: string;
  name: string;
  recurrence: BillWithStatus["recurrence"];
  amountMinorUnits: number;
  monthlyEquivalentMinorUnits: number;
}

export interface AnalyticsSummaryResult {
  period: { from: string; to: string };
  spendingByCategory: CategoryTotal[];
  spendingByMonth: SpendingByMonthEntry[];
  incomeVsExpenses: IncomeVsExpensesEntry[];
  budgetVsActual: BudgetWithStatus[];
  savingsContributions: SavingsContributionsSummary;
  goalProgress: GoalProgressSummary;
  recurringExpenseSummary: RecurringExpenseSummaryEntry[];
  highestExpenseCategories: CategoryTotal[];
}

const DEFAULT_HIGHEST_CATEGORIES_LIMIT = 5;
const OVERALL_PERCENTAGE_ROUNDING_FACTOR = 10;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly budgetsService: BudgetsService,
    private readonly billsService: BillsService,
    private readonly goalsService: GoalsService,
  ) {}

  /**
   * Composes existing report-scoped services into one response — same
   * "one call, many sections" shape as the dashboard and calendar.
   * `budgetVsActual`, `goalProgress`, and `recurringExpenseSummary` are
   * current-state snapshots that ignore `from`/`to`: a budget's "actual"
   * is always its current period (ADR-006), not an arbitrary past range.
   */
  async getSummary(userId: string, query: AnalyticsQuery): Promise<AnalyticsSummaryResult> {
    const { from, to, accountId, categoryId, limit } = query;

    const [spendingByCategory, monthly, budgets, goals, contributions, bills] = await Promise.all([
      this.transactionsService.getCategoryTotals(userId, from, to, accountId),
      this.transactionsService.getMonthlyTotals(userId, from, to, { accountId, categoryId }),
      this.budgetsService.findAllForUser(userId),
      this.goalsService.findAllForUser(userId, false),
      this.goalsService.findContributionsInRange(userId, new Date(from), new Date(to)),
      this.billsService.findAllForUser(userId, false),
    ]);

    return {
      period: { from, to },
      spendingByCategory,
      spendingByMonth: monthly.map((entry) => ({
        month: entry.month,
        totalMinorUnits: entry.expensesMinorUnits,
      })),
      incomeVsExpenses: monthly.map((entry) => ({
        month: entry.month,
        incomeMinorUnits: entry.incomeMinorUnits,
        expensesMinorUnits: entry.expensesMinorUnits,
        netMinorUnits: entry.incomeMinorUnits - entry.expensesMinorUnits,
      })),
      budgetVsActual: budgets,
      savingsContributions: this.summarizeContributions(contributions),
      goalProgress: this.summarizeGoalProgress(goals),
      recurringExpenseSummary: this.summarizeRecurringExpenses(bills),
      highestExpenseCategories: [...spendingByCategory]
        .sort((a, b) => b.totalMinorUnits - a.totalMinorUnits)
        .slice(0, limit ?? DEFAULT_HIGHEST_CATEGORIES_LIMIT),
    };
  }

  private summarizeContributions(
    contributions: Awaited<ReturnType<GoalsService["findContributionsInRange"]>>,
  ): SavingsContributionsSummary {
    const byGoal = new Map<string, { goalId: string; goalName: string; totalMinorUnits: number }>();
    for (const contribution of contributions) {
      const existing = byGoal.get(contribution.goalId);
      if (existing) {
        existing.totalMinorUnits += contribution.amountMinorUnits;
      } else {
        byGoal.set(contribution.goalId, {
          goalId: contribution.goalId,
          goalName: contribution.goalName,
          totalMinorUnits: contribution.amountMinorUnits,
        });
      }
    }

    return {
      totalMinorUnits: contributions.reduce((sum, c) => sum + c.amountMinorUnits, 0),
      byGoal: [...byGoal.values()],
    };
  }

  private summarizeGoalProgress(goals: GoalWithProgress[]): GoalProgressSummary {
    const activeGoals = goals.filter((goal) => goal.status === "ACTIVE");
    const totalSavedMinorUnits = activeGoals.reduce((sum, goal) => sum + goal.savedMinorUnits, 0);
    const totalTargetMinorUnits = activeGoals.reduce(
      (sum, goal) => sum + goal.targetAmountMinorUnits,
      0,
    );

    return {
      totalSavedMinorUnits,
      totalTargetMinorUnits,
      overallPercentage:
        totalTargetMinorUnits > 0
          ? Math.round((totalSavedMinorUnits / totalTargetMinorUnits) * 1000) /
            OVERALL_PERCENTAGE_ROUNDING_FACTOR
          : 0,
      goals: activeGoals,
    };
  }

  private summarizeRecurringExpenses(bills: BillWithStatus[]): RecurringExpenseSummaryEntry[] {
    return bills
      .filter((bill) => bill.recurrence !== "ONE_OFF")
      .map((bill) => ({
        billId: bill.id,
        name: bill.name,
        recurrence: bill.recurrence,
        amountMinorUnits: bill.amountMinorUnits,
        monthlyEquivalentMinorUnits: monthlyEquivalent(bill.amountMinorUnits, bill.recurrence),
      }));
  }
}
