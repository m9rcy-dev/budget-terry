import { NotFoundException } from "@nestjs/common";
import type { CategoriesService } from "../categories/categories.service";
import type { PrismaService } from "../prisma/prisma.service";
import { BudgetsService } from "./budgets.service";

function buildBudgetsService() {
  const tx = {
    budgetCategory: { deleteMany: jest.fn() },
    budget: { update: jest.fn() },
  };
  const prisma = {
    budget: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinorUnits: 0 } }),
    },
    $transaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) => callback(tx)),
  };
  const categoriesService = { findOneForUser: jest.fn() };

  const service = new BudgetsService(
    prisma as unknown as PrismaService,
    categoriesService as unknown as CategoriesService,
  );

  return { service, prisma, tx, categoriesService };
}

const overallBudget = {
  id: "budget-1",
  userId: "user-1",
  name: "Monthly",
  period: "MONTHLY" as const,
  anchorDate: new Date("2026-01-01T00:00:00.000Z"),
  currency: "NZD" as const,
  totalAmountMinorUnits: 100000,
  createdAt: new Date(),
  updatedAt: new Date(),
  budgetCategories: [],
};

const perCategoryBudget = {
  ...overallBudget,
  totalAmountMinorUnits: null,
  budgetCategories: [
    {
      id: "bc-1",
      budgetId: "budget-1",
      categoryId: "cat-1",
      amountMinorUnits: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {
        id: "cat-1",
        userId: "user-1",
        name: "Groceries",
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ],
};

describe("BudgetsService", () => {
  describe("create", () => {
    it("does not check category ownership for an overall budget", async () => {
      const { service, prisma, categoriesService } = buildBudgetsService();
      prisma.budget.create.mockResolvedValue(overallBudget);

      await service.create("user-1", {
        period: "MONTHLY",
        anchorDate: "2026-01-01",
        currency: "NZD",
        totalAmountMinorUnits: 100000,
      });

      expect(categoriesService.findOneForUser).not.toHaveBeenCalled();
    });

    it("verifies category ownership for a per-category budget", async () => {
      const { service, prisma, categoriesService } = buildBudgetsService();
      categoriesService.findOneForUser.mockResolvedValue({ id: "cat-1" });
      prisma.budget.create.mockResolvedValue(perCategoryBudget);

      await service.create("user-1", {
        period: "MONTHLY",
        anchorDate: "2026-01-01",
        currency: "NZD",
        categoryAllocations: [{ categoryId: "cat-1", amountMinorUnits: 50000 }],
      });

      expect(categoriesService.findOneForUser).toHaveBeenCalledWith("user-1", "cat-1");
    });

    it("propagates NotFoundException when a category doesn't belong to the user", async () => {
      const { service, categoriesService } = buildBudgetsService();
      categoriesService.findOneForUser.mockRejectedValue(
        new NotFoundException("Category was not found."),
      );

      await expect(
        service.create("user-1", {
          period: "MONTHLY",
          anchorDate: "2026-01-01",
          currency: "NZD",
          categoryAllocations: [{ categoryId: "cat-1", amountMinorUnits: 50000 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("findOneForUser", () => {
    it("throws NotFoundException when the budget doesn't exist or belongs to another user", async () => {
      const { service, prisma } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser("user-1", "budget-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("status computation — overall budget", () => {
    it.each([
      [0, 0, "HEALTHY"],
      [50000, 50, "HEALTHY"],
      [79000, 79, "HEALTHY"],
      [80000, 80, "APPROACHING"],
      [99000, 99, "APPROACHING"],
      [100000, 100, "EXCEEDED"],
      [150000, 150, "EXCEEDED"],
    ])(
      "spent=%i -> percentageUsed=%i, status=%s",
      async (spent, expectedPercentage, expectedStatus) => {
        const { service, prisma } = buildBudgetsService();
        prisma.budget.findFirst.mockResolvedValue(overallBudget);
        prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: spent } });

        const result = await service.findOneForUser("user-1", "budget-1");

        expect(result.spentMinorUnits).toBe(spent);
        expect(result.remainingMinorUnits).toBe(100000 - spent);
        expect(result.percentageUsed).toBe(expectedPercentage);
        expect(result.status).toBe(expectedStatus);
        expect(result.categories).toEqual([]);
      },
    );
  });

  describe("status computation — per-category budget", () => {
    it("computes status independently per category and leaves overall fields null", async () => {
      const { service, prisma } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue(perCategoryBudget);
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: 45000 } });

      const result = await service.findOneForUser("user-1", "budget-1");

      expect(result.totalAmountMinorUnits).toBeNull();
      expect(result.status).toBeNull();
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0]).toMatchObject({
        categoryId: "cat-1",
        categoryName: "Groceries",
        amountMinorUnits: 50000,
        spentMinorUnits: 45000,
        remainingMinorUnits: 5000,
        percentageUsed: 90,
        status: "APPROACHING",
      });
    });
  });

  describe("status computation — zero allocation edge case", () => {
    it("treats a zero-allocated budget with no spending as healthy", async () => {
      const { service, prisma } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue({ ...overallBudget, totalAmountMinorUnits: 0 });
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: 0 } });

      const result = await service.findOneForUser("user-1", "budget-1");

      expect(result.status).toBe("HEALTHY");
      expect(result.percentageUsed).toBe(0);
    });

    it("treats a zero-allocated budget with any spending as exceeded", async () => {
      const { service, prisma } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue({ ...overallBudget, totalAmountMinorUnits: 0 });
      prisma.transaction.aggregate.mockResolvedValue({ _sum: { amountMinorUnits: 100 } });

      const result = await service.findOneForUser("user-1", "budget-1");

      expect(result.status).toBe("EXCEEDED");
      expect(result.percentageUsed).toBe(100);
    });
  });

  describe("update", () => {
    it("replaces budgetCategories inside a transaction", async () => {
      const { service, prisma, tx, categoriesService } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue(overallBudget);
      categoriesService.findOneForUser.mockResolvedValue({ id: "cat-1" });
      tx.budget.update.mockResolvedValue(perCategoryBudget);

      await service.update("user-1", "budget-1", {
        period: "MONTHLY",
        anchorDate: "2026-01-01",
        currency: "NZD",
        categoryAllocations: [{ categoryId: "cat-1", amountMinorUnits: 50000 }],
      });

      expect(tx.budgetCategory.deleteMany).toHaveBeenCalledWith({
        where: { budgetId: "budget-1" },
      });
      expect(tx.budget.update).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("checks ownership before deleting", async () => {
      const { service, prisma } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue(overallBudget);
      prisma.budget.delete.mockResolvedValue(overallBudget);

      await service.remove("user-1", "budget-1");

      expect(prisma.budget.delete).toHaveBeenCalledWith({ where: { id: "budget-1" } });
    });

    it("rejects deleting another user's budget", async () => {
      const { service, prisma } = buildBudgetsService();
      prisma.budget.findFirst.mockResolvedValue(null);

      await expect(service.remove("user-1", "budget-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.budget.delete).not.toHaveBeenCalled();
    });
  });
});
