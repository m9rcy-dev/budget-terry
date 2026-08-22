import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { AccountsService } from "../accounts/accounts.service";
import type { PrismaService } from "../prisma/prisma.service";
import { GoalsService } from "./goals.service";

function buildGoalsService() {
  const tx = {
    goalContribution: { create: jest.fn() },
    transaction: { create: jest.fn() },
  };
  const prisma = {
    savingsGoal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) => callback(tx)),
  };
  const accountsService = { findOneForUser: jest.fn() };

  const service = new GoalsService(
    prisma as unknown as PrismaService,
    accountsService as unknown as AccountsService,
  );

  return { service, prisma, tx, accountsService };
}

function contribution(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "contrib-1",
    goalId: "goal-1",
    userId: "user-1",
    amountMinorUnits: 100000,
    currency: "NZD" as const,
    contributionDate: new Date("2026-08-01T00:00:00.000Z"),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    transaction: null,
    ...overrides,
  };
}

function goal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "goal-1",
    userId: "user-1",
    name: "Japan Holiday",
    targetAmountMinorUnits: 800000,
    currency: "NZD" as const,
    targetDate: null,
    accountId: null,
    notes: null,
    status: "ACTIVE" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    contributions: [],
    ...overrides,
  };
}

describe("GoalsService", () => {
  describe("create", () => {
    it("does not check account ownership when no accountId is given", async () => {
      const { service, prisma, accountsService } = buildGoalsService();
      prisma.savingsGoal.create.mockResolvedValue(goal());

      await service.create("user-1", {
        name: "Japan Holiday",
        targetAmountMinorUnits: 800000,
        currency: "NZD",
      });

      expect(accountsService.findOneForUser).not.toHaveBeenCalled();
    });

    it("verifies account ownership when accountId is given", async () => {
      const { service, prisma, accountsService } = buildGoalsService();
      accountsService.findOneForUser.mockResolvedValue({ id: "acct-1" });
      prisma.savingsGoal.create.mockResolvedValue(goal({ accountId: "acct-1" }));

      await service.create("user-1", {
        name: "Japan Holiday",
        targetAmountMinorUnits: 800000,
        currency: "NZD",
        accountId: "acct-1",
      });

      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acct-1");
    });
  });

  describe("findAllForUser", () => {
    it("hides ARCHIVED goals by default", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findMany.mockResolvedValue([]);

      await service.findAllForUser("user-1", false);

      expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", status: { not: "ARCHIVED" } },
        }),
      );
    });

    it("includes ARCHIVED goals when includeArchived is true", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findMany.mockResolvedValue([]);

      await service.findAllForUser("user-1", true);

      expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1" } }),
      );
    });
  });

  describe("findOneForUser", () => {
    it("throws NotFoundException when the goal doesn't exist or belongs to another user", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser("user-1", "goal-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("progress computation", () => {
    it("sums contributions for savedMinorUnits and computes remaining/percentage", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(
        goal({
          targetAmountMinorUnits: 800000,
          contributions: [
            contribution({ amountMinorUnits: 200000 }),
            contribution({ amountMinorUnits: 125000 }),
          ],
        }),
      );

      const result = await service.findOneForUser("user-1", "goal-1");

      expect(result.savedMinorUnits).toBe(325000);
      expect(result.remainingMinorUnits).toBe(475000);
      expect(result.percentageComplete).toBe(40.6);
    });

    it("clamps remaining at zero when contributions overshoot the target", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(
        goal({
          targetAmountMinorUnits: 100000,
          contributions: [contribution({ amountMinorUnits: 150000 })],
        }),
      );

      const result = await service.findOneForUser("user-1", "goal-1");

      expect(result.remainingMinorUnits).toBe(0);
    });

    it("returns a null suggested contribution when there's no targetDate", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(goal({ targetDate: null }));

      const result = await service.findOneForUser("user-1", "goal-1");

      expect(result.suggestedMonthlyContributionMinorUnits).toBeNull();
    });

    it("computes a suggested monthly contribution when a targetDate is set", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
      try {
        const { service, prisma } = buildGoalsService();
        prisma.savingsGoal.findFirst.mockResolvedValue(
          goal({
            targetAmountMinorUnits: 600000,
            targetDate: new Date("2027-02-01T00:00:00.000Z"),
            contributions: [],
          }),
        );

        const result = await service.findOneForUser("user-1", "goal-1");

        expect(result.suggestedMonthlyContributionMinorUnits).toBe(100000);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("addContribution", () => {
    it("rejects when the goal has no default account and none was provided", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(goal({ accountId: null }));

      await expect(
        service.addContribution("user-1", "goal-1", { amountMinorUnits: 1000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates a linked transaction using the goal's default account", async () => {
      const { service, prisma, tx, accountsService } = buildGoalsService();
      accountsService.findOneForUser.mockResolvedValue({ id: "acct-1" });
      prisma.savingsGoal.findFirst
        .mockResolvedValueOnce(goal({ accountId: "acct-1" }))
        .mockResolvedValueOnce(goal({ accountId: "acct-1", contributions: [contribution()] }));
      tx.goalContribution.create.mockResolvedValue(contribution());

      await service.addContribution("user-1", "goal-1", { amountMinorUnits: 100000 });

      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acct-1");
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          accountId: "acct-1",
          categoryId: null,
          type: "EXPENSE",
          amountMinorUnits: 100000,
          relatedGoalContributionId: "contrib-1",
        }),
      });
    });

    it("uses an explicitly provided accountId over the goal's default", async () => {
      const { service, prisma, tx, accountsService } = buildGoalsService();
      accountsService.findOneForUser.mockResolvedValue({ id: "acct-2" });
      prisma.savingsGoal.findFirst
        .mockResolvedValueOnce(goal({ accountId: "acct-1" }))
        .mockResolvedValueOnce(goal({ accountId: "acct-1" }));
      tx.goalContribution.create.mockResolvedValue(contribution());

      await service.addContribution("user-1", "goal-1", {
        amountMinorUnits: 100000,
        accountId: "acct-2",
      });

      expect(accountsService.findOneForUser).toHaveBeenCalledWith("user-1", "acct-2");
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ accountId: "acct-2" }),
      });
    });
  });

  describe("complete / archive / restore", () => {
    it("sets status to COMPLETED", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(goal());
      prisma.savingsGoal.update.mockResolvedValue(goal({ status: "COMPLETED" }));

      const result = await service.complete("user-1", "goal-1");

      expect(prisma.savingsGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "COMPLETED" } }),
      );
      expect(result.status).toBe("COMPLETED");
    });

    it("rejects archiving another user's goal", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(null);

      await expect(service.archive("user-1", "goal-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sets status back to ACTIVE on restore", async () => {
      const { service, prisma } = buildGoalsService();
      prisma.savingsGoal.findFirst.mockResolvedValue(goal({ status: "ARCHIVED" }));
      prisma.savingsGoal.update.mockResolvedValue(goal({ status: "ACTIVE" }));

      const result = await service.restore("user-1", "goal-1");

      expect(result.status).toBe("ACTIVE");
    });
  });
});
