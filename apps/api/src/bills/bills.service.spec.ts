import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type { AccountsService } from "../accounts/accounts.service";
import type { CategoriesService } from "../categories/categories.service";
import type { PrismaService } from "../prisma/prisma.service";
import { BillsService } from "./bills.service";

function buildBillsService() {
  const tx = {
    bill: { update: jest.fn() },
    billOccurrence: { updateMany: jest.fn(), update: jest.fn() },
    transaction: { create: jest.fn() },
  };
  const prisma = {
    bill: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    billOccurrence: { createMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) => callback(tx)),
  };
  const accountsService = { findOneForUser: jest.fn() };
  const categoriesService = { findOneForUser: jest.fn() };

  const service = new BillsService(
    prisma as unknown as PrismaService,
    accountsService as unknown as AccountsService,
    categoriesService as unknown as CategoriesService,
  );

  return { service, prisma, tx, accountsService, categoriesService };
}

function occurrence(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "occ-1",
    billId: "bill-1",
    userId: "user-1",
    // Far beyond any realistic test-run date + the 90-day horizon, so
    // ensureOccurrencesGenerated's top-up branch never triggers here —
    // that behavior gets its own tests below with fixed system time.
    dueDate: new Date("2030-01-01T00:00:00.000Z"),
    amountMinorUnits: 18400,
    currency: "NZD" as const,
    paymentStatus: "PENDING" as const,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    transaction: null,
    ...overrides,
  };
}

function bill(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "bill-1",
    userId: "user-1",
    name: "Electricity",
    amountMinorUnits: 18400,
    currency: "NZD" as const,
    categoryId: null,
    accountId: null,
    recurrence: "MONTHLY" as const,
    autoPay: false,
    notes: null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    occurrences: [occurrence()],
    ...overrides,
  };
}

describe("BillsService", () => {
  describe("create", () => {
    it("does not check ownership when no category/account is given", async () => {
      const { service, prisma, accountsService, categoriesService } = buildBillsService();
      prisma.bill.create.mockResolvedValue(bill({ recurrence: "ONE_OFF" }));

      await service.create("user-1", {
        name: "Car rego",
        amountMinorUnits: 12000,
        currency: "NZD",
        recurrence: "ONE_OFF",
        firstDueDate: "2026-08-20",
        autoPay: false,
      });

      expect(categoriesService.findOneForUser).not.toHaveBeenCalled();
      expect(accountsService.findOneForUser).not.toHaveBeenCalled();
    });

    it("verifies category and account ownership when both are given", async () => {
      const { service, prisma, accountsService, categoriesService } = buildBillsService();
      categoriesService.findOneForUser.mockResolvedValue({ id: "cat-1" });
      accountsService.findOneForUser.mockResolvedValue({ id: "acct-1" });
      prisma.bill.create.mockResolvedValue(bill());

      await service.create("user-1", {
        name: "Electricity",
        amountMinorUnits: 18400,
        currency: "NZD",
        recurrence: "MONTHLY",
        firstDueDate: "2026-08-20",
        categoryId: "cat-1",
        accountId: "acct-1",
        autoPay: false,
      });

      expect(categoriesService.findOneForUser).toHaveBeenCalledWith("user-1", "cat-1");
      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acct-1");
    });

    it("creates exactly one occurrence for a ONE_OFF bill", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.create.mockResolvedValue(bill({ recurrence: "ONE_OFF" }));

      await service.create("user-1", {
        name: "Car rego",
        amountMinorUnits: 12000,
        currency: "NZD",
        recurrence: "ONE_OFF",
        firstDueDate: "2026-08-20",
        autoPay: false,
      });

      const callArgs = prisma.bill.create.mock.calls[0][0];
      expect(callArgs.data.occurrences.create).toHaveLength(1);
      expect(callArgs.data.occurrences.create[0].dueDate.toISOString().slice(0, 10)).toBe(
        "2026-08-20",
      );
    });

    it("generates multiple occurrences for a recurring bill within the horizon", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
      try {
        const { service, prisma } = buildBillsService();
        prisma.bill.create.mockResolvedValue(bill());

        await service.create("user-1", {
          name: "Electricity",
          amountMinorUnits: 18400,
          currency: "NZD",
          recurrence: "MONTHLY",
          firstDueDate: "2026-08-01",
          autoPay: false,
        });

        const callArgs = prisma.bill.create.mock.calls[0][0];
        // 90-day horizon from 2026-08-01 fits Aug/Sep/Oct occurrences.
        expect(callArgs.data.occurrences.create.length).toBeGreaterThanOrEqual(3);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("findOneForUser", () => {
    it("throws NotFoundException when the bill doesn't exist or belongs to another user", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser("user-1", "bill-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("tops up occurrences when the last one falls short of the horizon", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-15T00:00:00.000Z"));
      try {
        const { service, prisma } = buildBillsService();
        const staleOccurrence = occurrence({ dueDate: new Date("2026-08-20T00:00:00.000Z") });
        prisma.bill.findFirst
          .mockResolvedValueOnce(bill({ occurrences: [staleOccurrence] }))
          .mockResolvedValueOnce(
            bill({ occurrences: [staleOccurrence, occurrence({ id: "occ-2" })] }),
          );

        await service.findOneForUser("user-1", "bill-1");

        expect(prisma.billOccurrence.createMany).toHaveBeenCalled();
        expect(prisma.bill.findFirst).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it("does not generate more occurrences for a ONE_OFF bill", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-15T00:00:00.000Z"));
      try {
        const { service, prisma } = buildBillsService();
        prisma.bill.findFirst.mockResolvedValue(bill({ recurrence: "ONE_OFF" }));

        await service.findOneForUser("user-1", "bill-1");

        expect(prisma.billOccurrence.createMany).not.toHaveBeenCalled();
        expect(prisma.bill.findFirst).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it("does not generate more occurrences for an archived bill", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-15T00:00:00.000Z"));
      try {
        const { service, prisma } = buildBillsService();
        const staleOccurrence = occurrence({ dueDate: new Date("2026-08-16T00:00:00.000Z") });
        prisma.bill.findFirst.mockResolvedValue(
          bill({ isArchived: true, occurrences: [staleOccurrence] }),
        );

        await service.findOneForUser("user-1", "bill-1");

        expect(prisma.billOccurrence.createMany).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("update", () => {
    it("propagates an amount change to PENDING occurrences only", async () => {
      const { service, prisma, tx } = buildBillsService();
      prisma.bill.findFirst
        .mockResolvedValueOnce(bill({ amountMinorUnits: 18400 }))
        .mockResolvedValueOnce(bill({ amountMinorUnits: 20000 }));

      await service.update("user-1", "bill-1", { amountMinorUnits: 20000 });

      expect(tx.billOccurrence.updateMany).toHaveBeenCalledWith({
        where: { billId: "bill-1", paymentStatus: "PENDING" },
        data: { amountMinorUnits: 20000 },
      });
    });

    it("does not touch occurrences when the amount is unchanged", async () => {
      const { service, prisma, tx } = buildBillsService();
      prisma.bill.findFirst
        .mockResolvedValueOnce(bill({ amountMinorUnits: 18400 }))
        .mockResolvedValueOnce(bill({ amountMinorUnits: 18400 }));

      await service.update("user-1", "bill-1", { name: "Renamed" });

      expect(tx.billOccurrence.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("markOccurrencePaid", () => {
    it("is idempotent — an already-PAID occurrence does not create a second transaction", async () => {
      const { service, prisma, tx } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(
        bill({ occurrences: [occurrence({ paymentStatus: "PAID" })] }),
      );

      await service.markOccurrencePaid("user-1", "bill-1", "occ-1", {});

      expect(tx.transaction.create).not.toHaveBeenCalled();
    });

    it("rejects paying when the bill has no default account and none was provided", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(bill({ accountId: null }));

      await expect(
        service.markOccurrencePaid("user-1", "bill-1", "occ-1", {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates a linked transaction and marks the occurrence PAID using the bill's default account", async () => {
      const { service, prisma, tx, accountsService } = buildBillsService();
      accountsService.findOneForUser.mockResolvedValue({ id: "acct-1" });
      prisma.bill.findFirst
        .mockResolvedValueOnce(bill({ accountId: "acct-1", categoryId: "cat-1" }))
        .mockResolvedValueOnce(bill({ accountId: "acct-1", categoryId: "cat-1" }));

      await service.markOccurrencePaid("user-1", "bill-1", "occ-1", {});

      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acct-1");
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          accountId: "acct-1",
          categoryId: "cat-1",
          type: "EXPENSE",
          amountMinorUnits: 18400,
          relatedBillOccurrenceId: "occ-1",
        }),
      });
      expect(tx.billOccurrence.update).toHaveBeenCalledWith({
        where: { id: "occ-1" },
        data: expect.objectContaining({ paymentStatus: "PAID" }),
      });
    });

    it("uses an explicitly provided accountId over the bill's default", async () => {
      const { service, prisma, tx, accountsService } = buildBillsService();
      accountsService.findOneForUser.mockResolvedValue({ id: "acct-2" });
      prisma.bill.findFirst
        .mockResolvedValueOnce(bill({ accountId: "acct-1" }))
        .mockResolvedValueOnce(bill({ accountId: "acct-1" }));

      await service.markOccurrencePaid("user-1", "bill-1", "occ-1", { accountId: "acct-2" });

      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acct-2");
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accountId: "acct-2" }),
      });
    });

    it("throws NotFoundException for an occurrence that doesn't belong to the bill", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(bill({ occurrences: [occurrence({ id: "occ-1" })] }));

      await expect(
        service.markOccurrencePaid("user-1", "bill-1", "occ-does-not-exist", {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("markOccurrenceSkipped", () => {
    it("is idempotent — an already-SKIPPED occurrence is returned as-is", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(
        bill({ occurrences: [occurrence({ paymentStatus: "SKIPPED" })] }),
      );

      const result = await service.markOccurrenceSkipped("user-1", "bill-1", "occ-1");

      expect(result.occurrences[0]!.paymentStatus).toBe("SKIPPED");
    });

    it("rejects skipping an occurrence that's already been paid", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(
        bill({ occurrences: [occurrence({ paymentStatus: "PAID" })] }),
      );

      await expect(
        service.markOccurrenceSkipped("user-1", "bill-1", "occ-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("marks a PENDING occurrence SKIPPED", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst
        .mockResolvedValueOnce(bill())
        .mockResolvedValueOnce(bill({ occurrences: [occurrence({ paymentStatus: "SKIPPED" })] }));

      await service.markOccurrenceSkipped("user-1", "bill-1", "occ-1");

      expect(prisma.billOccurrence.update).toHaveBeenCalledWith({
        where: { id: "occ-1" },
        data: { paymentStatus: "SKIPPED" },
      });
    });
  });

  describe("archive / restore", () => {
    it("rejects archiving another user's bill", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(null);

      await expect(service.archive("user-1", "bill-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("archives an owned bill", async () => {
      const { service, prisma } = buildBillsService();
      prisma.bill.findFirst.mockResolvedValue(bill());
      prisma.bill.update.mockResolvedValue(bill({ isArchived: true }));

      const result = await service.archive("user-1", "bill-1");

      expect(result.isArchived).toBe(true);
    });
  });
});
