import type { BillsService } from "../bills/bills.service";
import type { BudgetsService } from "../budgets/budgets.service";
import type { GoalsService } from "../goals/goals.service";
import type { TransactionsService } from "../transactions/transactions.service";
import { AnalyticsService } from "./analytics.service";

function buildAnalyticsService() {
  const transactionsService = { getCategoryTotals: jest.fn(), getMonthlyTotals: jest.fn() };
  const budgetsService = { findAllForUser: jest.fn() };
  const billsService = { findAllForUser: jest.fn() };
  const goalsService = { findAllForUser: jest.fn(), findContributionsInRange: jest.fn() };

  const service = new AnalyticsService(
    transactionsService as unknown as TransactionsService,
    budgetsService as unknown as BudgetsService,
    billsService as unknown as BillsService,
    goalsService as unknown as GoalsService,
  );

  return { service, transactionsService, budgetsService, billsService, goalsService };
}

function baseQuery(overrides: Partial<Record<string, unknown>> = {}) {
  return { from: "2026-08-01", to: "2026-08-31", ...overrides };
}

describe("AnalyticsService", () => {
  it("forwards from/to/accountId/categoryId to the underlying collaborators", async () => {
    const { service, transactionsService, budgetsService, billsService, goalsService } =
      buildAnalyticsService();
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.getMonthlyTotals.mockResolvedValue([]);
    budgetsService.findAllForUser.mockResolvedValue([]);
    billsService.findAllForUser.mockResolvedValue([]);
    goalsService.findAllForUser.mockResolvedValue([]);
    goalsService.findContributionsInRange.mockResolvedValue([]);

    await service.getSummary(
      "user-1",
      baseQuery({ accountId: "acct-1", categoryId: "cat-1" }) as never,
    );

    expect(transactionsService.getCategoryTotals).toHaveBeenCalledWith(
      "user-1",
      "2026-08-01",
      "2026-08-31",
      "acct-1",
    );
    expect(transactionsService.getMonthlyTotals).toHaveBeenCalledWith(
      "user-1",
      "2026-08-01",
      "2026-08-31",
      { accountId: "acct-1", categoryId: "cat-1" },
    );
  });

  it("derives spendingByMonth as the expense side of the monthly totals", async () => {
    const { service, transactionsService, budgetsService, billsService, goalsService } =
      buildAnalyticsService();
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.getMonthlyTotals.mockResolvedValue([
      { month: "2026-08", incomeMinorUnits: 400000, expensesMinorUnits: 30000 },
    ]);
    budgetsService.findAllForUser.mockResolvedValue([]);
    billsService.findAllForUser.mockResolvedValue([]);
    goalsService.findAllForUser.mockResolvedValue([]);
    goalsService.findContributionsInRange.mockResolvedValue([]);

    const result = await service.getSummary("user-1", baseQuery() as never);

    expect(result.spendingByMonth).toEqual([{ month: "2026-08", totalMinorUnits: 30000 }]);
  });

  it("computes netMinorUnits for incomeVsExpenses", async () => {
    const { service, transactionsService, budgetsService, billsService, goalsService } =
      buildAnalyticsService();
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.getMonthlyTotals.mockResolvedValue([
      { month: "2026-08", incomeMinorUnits: 400000, expensesMinorUnits: 30000 },
    ]);
    budgetsService.findAllForUser.mockResolvedValue([]);
    billsService.findAllForUser.mockResolvedValue([]);
    goalsService.findAllForUser.mockResolvedValue([]);
    goalsService.findContributionsInRange.mockResolvedValue([]);

    const result = await service.getSummary("user-1", baseQuery() as never);

    expect(result.incomeVsExpenses).toEqual([
      {
        month: "2026-08",
        incomeMinorUnits: 400000,
        expensesMinorUnits: 30000,
        netMinorUnits: 370000,
      },
    ]);
  });

  describe("highestExpenseCategories", () => {
    it("sorts descending and limits to the default of 5", async () => {
      const { service, transactionsService, budgetsService, billsService, goalsService } =
        buildAnalyticsService();
      const categories = Array.from({ length: 7 }, (_, index) => ({
        categoryId: `cat-${index}`,
        categoryName: `Category ${index}`,
        totalMinorUnits: index * 100,
      }));
      transactionsService.getCategoryTotals.mockResolvedValue(categories);
      transactionsService.getMonthlyTotals.mockResolvedValue([]);
      budgetsService.findAllForUser.mockResolvedValue([]);
      billsService.findAllForUser.mockResolvedValue([]);
      goalsService.findAllForUser.mockResolvedValue([]);
      goalsService.findContributionsInRange.mockResolvedValue([]);

      const result = await service.getSummary("user-1", baseQuery() as never);

      expect(result.highestExpenseCategories).toHaveLength(5);
      expect(result.highestExpenseCategories[0]!.categoryId).toBe("cat-6");
      expect(result.highestExpenseCategories[4]!.categoryId).toBe("cat-2");
    });

    it("respects an explicit limit", async () => {
      const { service, transactionsService, budgetsService, billsService, goalsService } =
        buildAnalyticsService();
      transactionsService.getCategoryTotals.mockResolvedValue([
        { categoryId: "cat-1", categoryName: "A", totalMinorUnits: 100 },
        { categoryId: "cat-2", categoryName: "B", totalMinorUnits: 200 },
      ]);
      transactionsService.getMonthlyTotals.mockResolvedValue([]);
      budgetsService.findAllForUser.mockResolvedValue([]);
      billsService.findAllForUser.mockResolvedValue([]);
      goalsService.findAllForUser.mockResolvedValue([]);
      goalsService.findContributionsInRange.mockResolvedValue([]);

      const result = await service.getSummary("user-1", baseQuery({ limit: 1 }) as never);

      expect(result.highestExpenseCategories).toEqual([
        { categoryId: "cat-2", categoryName: "B", totalMinorUnits: 200 },
      ]);
    });
  });

  describe("savingsContributions", () => {
    it("sums contributions per goal and overall", async () => {
      const { service, transactionsService, budgetsService, billsService, goalsService } =
        buildAnalyticsService();
      transactionsService.getCategoryTotals.mockResolvedValue([]);
      transactionsService.getMonthlyTotals.mockResolvedValue([]);
      budgetsService.findAllForUser.mockResolvedValue([]);
      billsService.findAllForUser.mockResolvedValue([]);
      goalsService.findAllForUser.mockResolvedValue([]);
      goalsService.findContributionsInRange.mockResolvedValue([
        {
          contributionId: "c1",
          goalId: "goal-1",
          goalName: "Japan Holiday",
          amountMinorUnits: 10000,
        },
        {
          contributionId: "c2",
          goalId: "goal-1",
          goalName: "Japan Holiday",
          amountMinorUnits: 5000,
        },
        {
          contributionId: "c3",
          goalId: "goal-2",
          goalName: "Emergency Fund",
          amountMinorUnits: 20000,
        },
      ]);

      const result = await service.getSummary("user-1", baseQuery() as never);

      expect(result.savingsContributions.totalMinorUnits).toBe(35000);
      expect(result.savingsContributions.byGoal).toEqual([
        { goalId: "goal-1", goalName: "Japan Holiday", totalMinorUnits: 15000 },
        { goalId: "goal-2", goalName: "Emergency Fund", totalMinorUnits: 20000 },
      ]);
    });
  });

  describe("goalProgress", () => {
    it("only counts ACTIVE goals toward the totals", async () => {
      const { service, transactionsService, budgetsService, billsService, goalsService } =
        buildAnalyticsService();
      transactionsService.getCategoryTotals.mockResolvedValue([]);
      transactionsService.getMonthlyTotals.mockResolvedValue([]);
      budgetsService.findAllForUser.mockResolvedValue([]);
      billsService.findAllForUser.mockResolvedValue([]);
      goalsService.findContributionsInRange.mockResolvedValue([]);
      goalsService.findAllForUser.mockResolvedValue([
        { id: "g1", status: "ACTIVE", savedMinorUnits: 25000, targetAmountMinorUnits: 100000 },
        { id: "g2", status: "COMPLETED", savedMinorUnits: 50000, targetAmountMinorUnits: 50000 },
        { id: "g3", status: "ARCHIVED", savedMinorUnits: 1000, targetAmountMinorUnits: 5000 },
      ]);

      const result = await service.getSummary("user-1", baseQuery() as never);

      expect(result.goalProgress.goals).toHaveLength(1);
      expect(result.goalProgress.totalSavedMinorUnits).toBe(25000);
      expect(result.goalProgress.totalTargetMinorUnits).toBe(100000);
      expect(result.goalProgress.overallPercentage).toBe(25);
    });

    it("returns 0% when there are no active goals to avoid dividing by zero", async () => {
      const { service, transactionsService, budgetsService, billsService, goalsService } =
        buildAnalyticsService();
      transactionsService.getCategoryTotals.mockResolvedValue([]);
      transactionsService.getMonthlyTotals.mockResolvedValue([]);
      budgetsService.findAllForUser.mockResolvedValue([]);
      billsService.findAllForUser.mockResolvedValue([]);
      goalsService.findContributionsInRange.mockResolvedValue([]);
      goalsService.findAllForUser.mockResolvedValue([]);

      const result = await service.getSummary("user-1", baseQuery() as never);

      expect(result.goalProgress.overallPercentage).toBe(0);
    });
  });

  describe("recurringExpenseSummary", () => {
    it("excludes ONE_OFF bills and computes the monthly-equivalent cost", async () => {
      const { service, transactionsService, budgetsService, billsService, goalsService } =
        buildAnalyticsService();
      transactionsService.getCategoryTotals.mockResolvedValue([]);
      transactionsService.getMonthlyTotals.mockResolvedValue([]);
      budgetsService.findAllForUser.mockResolvedValue([]);
      goalsService.findAllForUser.mockResolvedValue([]);
      goalsService.findContributionsInRange.mockResolvedValue([]);
      billsService.findAllForUser.mockResolvedValue([
        { id: "bill-1", name: "Internet", recurrence: "MONTHLY", amountMinorUnits: 8500 },
        { id: "bill-2", name: "Rates", recurrence: "QUARTERLY", amountMinorUnits: 30000 },
        { id: "bill-3", name: "Car rego", recurrence: "ONE_OFF", amountMinorUnits: 12000 },
      ]);

      const result = await service.getSummary("user-1", baseQuery() as never);

      expect(result.recurringExpenseSummary).toEqual([
        {
          billId: "bill-1",
          name: "Internet",
          recurrence: "MONTHLY",
          amountMinorUnits: 8500,
          monthlyEquivalentMinorUnits: 8500,
        },
        {
          billId: "bill-2",
          name: "Rates",
          recurrence: "QUARTERLY",
          amountMinorUnits: 30000,
          monthlyEquivalentMinorUnits: 10000,
        },
      ]);
    });
  });

  it("passes budgetVsActual through unchanged from BudgetsService", async () => {
    const { service, transactionsService, budgetsService, billsService, goalsService } =
      buildAnalyticsService();
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.getMonthlyTotals.mockResolvedValue([]);
    const budgets = [{ id: "budget-1", status: "HEALTHY" }];
    budgetsService.findAllForUser.mockResolvedValue(budgets);
    billsService.findAllForUser.mockResolvedValue([]);
    goalsService.findAllForUser.mockResolvedValue([]);
    goalsService.findContributionsInRange.mockResolvedValue([]);

    const result = await service.getSummary("user-1", baseQuery() as never);

    expect(result.budgetVsActual).toBe(budgets);
  });
});
