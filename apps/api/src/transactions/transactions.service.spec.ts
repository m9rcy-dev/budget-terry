import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AccountsService } from "../accounts/accounts.service";
import type { CategoriesService } from "../categories/categories.service";
import type { PrismaService } from "../prisma/prisma.service";
import { TransactionsService } from "./transactions.service";

function uniqueViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint violated", {
    code: "P2002",
    clientVersion: "test",
  });
}

function buildTransactionsService() {
  const prisma = {
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
  };
  const accountsService = { findOneForUser: jest.fn() };
  const categoriesService = { findOneForUser: jest.fn() };

  const service = new TransactionsService(
    prisma as unknown as PrismaService,
    accountsService as unknown as AccountsService,
    categoriesService as unknown as CategoriesService,
  );

  return { service, prisma, accountsService, categoriesService };
}

const baseInput = {
  accountId: "acc-1",
  categoryId: "cat-1",
  type: "EXPENSE" as const,
  amountMinorUnits: 500,
  currency: "NZD" as const,
  transactionDate: "2026-08-19",
};

describe("TransactionsService", () => {
  describe("create", () => {
    it("verifies account and category ownership before creating", async () => {
      const { service, prisma, accountsService, categoriesService } = buildTransactionsService();
      accountsService.findOneForUser.mockResolvedValue({ id: "acc-1" });
      categoriesService.findOneForUser.mockResolvedValue({ id: "cat-1" });
      prisma.transaction.create.mockResolvedValue({ id: "txn-1" });

      await service.create("user-1", baseInput);

      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acc-1");
      expect(categoriesService.findOneForUser).toHaveBeenCalledWith("user-1", "cat-1");
      expect(prisma.transaction.create).toHaveBeenCalled();
    });

    it("propagates NotFoundException when the account belongs to another user", async () => {
      const { service, accountsService } = buildTransactionsService();
      accountsService.findOneForUser.mockRejectedValue(
        new NotFoundException("Account was not found."),
      );

      await expect(service.create("user-1", baseInput)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("replays an already-seen idempotency key instead of creating again", async () => {
      const { service, prisma, accountsService } = buildTransactionsService();
      prisma.transaction.findUnique.mockResolvedValue({ id: "existing-txn" });

      const result = await service.create("user-1", baseInput, "key-1");

      expect(result).toEqual({ id: "existing-txn" });
      expect(accountsService.findOneForUser).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it("on a concurrent race for the same key, fetches and returns the row the other request created", async () => {
      const { service, prisma, accountsService, categoriesService } = buildTransactionsService();
      prisma.transaction.findUnique.mockResolvedValue(null);
      accountsService.findOneForUser.mockResolvedValue({ id: "acc-1" });
      categoriesService.findOneForUser.mockResolvedValue({ id: "cat-1" });
      prisma.transaction.create.mockRejectedValue(uniqueViolationError());
      prisma.transaction.findUniqueOrThrow.mockResolvedValue({ id: "winner-txn" });

      const result = await service.create("user-1", baseInput, "key-1");

      expect(result).toEqual({ id: "winner-txn" });
    });
  });

  describe("findOneForUser", () => {
    it("throws NotFoundException when the transaction doesn't exist or belongs to another user", async () => {
      const { service, prisma } = buildTransactionsService();
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser("user-1", "txn-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("findAllForUser", () => {
    it("builds the where clause from provided filters and paginates", async () => {
      const { service, prisma } = buildTransactionsService();
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAllForUser("user-1", {
        page: 2,
        pageSize: 10,
        accountId: "acc-1",
        type: "EXPENSE",
        from: "2026-08-01",
        to: "2026-08-31",
        search: "coffee",
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          accountId: "acc-1",
          type: "EXPENSE",
          transactionDate: { gte: new Date("2026-08-01"), lte: new Date("2026-08-31") },
          OR: [
            { merchant: { contains: "coffee", mode: "insensitive" } },
            { description: { contains: "coffee", mode: "insensitive" } },
          ],
        },
        orderBy: { transactionDate: "desc" },
        skip: 10,
        take: 10,
      });
    });
  });

  describe("remove", () => {
    it("checks ownership before deleting", async () => {
      const { service, prisma } = buildTransactionsService();
      prisma.transaction.findFirst.mockResolvedValue({ id: "txn-1", userId: "user-1" });
      prisma.transaction.delete.mockResolvedValue({ id: "txn-1" });

      await service.remove("user-1", "txn-1");

      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: "txn-1" } });
    });

    it("rejects deleting another user's transaction", async () => {
      const { service, prisma } = buildTransactionsService();
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.remove("user-1", "txn-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });
  });

  describe("getCategoryTotals", () => {
    it("maps a null categoryId group to an Uncategorized bucket", async () => {
      const { service, prisma } = buildTransactionsService();
      prisma.transaction.groupBy.mockResolvedValue([
        { categoryId: "cat-1", _sum: { amountMinorUnits: 1000 } },
        { categoryId: null, _sum: { amountMinorUnits: 250 } },
      ]);
      prisma.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Groceries" }]);

      const result = await service.getCategoryTotals("user-1", "2026-08-01", "2026-08-31");

      expect(result).toEqual([
        { categoryId: "cat-1", categoryName: "Groceries", totalMinorUnits: 1000 },
        { categoryId: "uncategorized", categoryName: "Uncategorized", totalMinorUnits: 250 },
      ]);
    });
  });
});
