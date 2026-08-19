import type { PrismaService } from "../prisma/prisma.service";
import type { TransactionsService } from "../transactions/transactions.service";
import { DashboardService } from "./dashboard.service";

function buildDashboardService() {
  const prisma = {
    transaction: {
      aggregate: jest.fn(),
    },
  };
  const transactionsService = {
    getCategoryTotals: jest.fn(),
    findAllForUser: jest.fn(),
  };

  const service = new DashboardService(
    prisma as unknown as PrismaService,
    transactionsService as unknown as TransactionsService,
  );

  return { service, prisma, transactionsService };
}

describe("DashboardService", () => {
  it("defaults to the current calendar month when from/to are omitted", async () => {
    const { service, prisma, transactionsService } = buildDashboardService();
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: 0 } });
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.findAllForUser.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
    });

    const now = new Date();
    const expectedFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
    const expectedTo = now.toISOString().slice(0, 10);

    const result = await service.getSummary("user-1");

    expect(result.period).toEqual({ from: expectedFrom, to: expectedTo });
    expect(transactionsService.getCategoryTotals).toHaveBeenCalledWith(
      "user-1",
      expectedFrom,
      expectedTo,
    );
  });

  it("uses the provided from/to when given", async () => {
    const { service, prisma, transactionsService } = buildDashboardService();
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: 0 } });
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.findAllForUser.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
    });

    const result = await service.getSummary("user-1", "2026-01-01", "2026-01-31");

    expect(result.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(transactionsService.getCategoryTotals).toHaveBeenCalledWith(
      "user-1",
      "2026-01-01",
      "2026-01-31",
    );
  });

  it("computes net as income minus expenses", async () => {
    const { service, prisma, transactionsService } = buildDashboardService();
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amountMinorUnits: 500000 } }) // income
      .mockResolvedValueOnce({ _sum: { amountMinorUnits: 320000 } }); // expenses
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.findAllForUser.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
    });

    const result = await service.getSummary("user-1", "2026-01-01", "2026-01-31");

    expect(result.incomeMinorUnits).toBe(500000);
    expect(result.expensesMinorUnits).toBe(320000);
    expect(result.netMinorUnits).toBe(180000);
  });

  it("treats a null aggregate sum (no matching transactions) as zero", async () => {
    const { service, prisma, transactionsService } = buildDashboardService();
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: null } });
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.findAllForUser.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
    });

    const result = await service.getSummary("user-1", "2026-01-01", "2026-01-31");

    expect(result.incomeMinorUnits).toBe(0);
    expect(result.expensesMinorUnits).toBe(0);
    expect(result.netMinorUnits).toBe(0);
  });

  it("requests the 5 most recent transactions", async () => {
    const { service, prisma, transactionsService } = buildDashboardService();
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: 0 } });
    transactionsService.getCategoryTotals.mockResolvedValue([]);
    transactionsService.findAllForUser.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
    });

    await service.getSummary("user-1", "2026-01-01", "2026-01-31");

    expect(transactionsService.findAllForUser).toHaveBeenCalledWith("user-1", {
      page: 1,
      pageSize: 5,
    });
  });
});
