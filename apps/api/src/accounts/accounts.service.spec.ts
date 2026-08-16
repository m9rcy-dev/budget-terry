import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { AccountsService } from "./accounts.service";

function buildAccountsService() {
  const prisma = {
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const service = new AccountsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

function fkViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
    code: "P2003",
    clientVersion: "test",
  });
}

describe("AccountsService", () => {
  describe("findAllForUser", () => {
    it("excludes archived accounts by default", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findMany.mockResolvedValue([]);

      await service.findAllForUser("user-1", false);

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isArchived: false },
        orderBy: { name: "asc" },
      });
    });

    it("includes archived accounts when asked", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findMany.mockResolvedValue([]);

      await service.findAllForUser("user-1", true);

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("findOneForUser", () => {
    it("returns the account when it belongs to the user", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });

      const result = await service.findOneForUser("user-1", "acc-1");

      expect(result).toEqual({ id: "acc-1", userId: "user-1" });
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: "acc-1", userId: "user-1" },
      });
    });

    it("throws NotFoundException when the account doesn't exist or belongs to another user", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser("user-1", "acc-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("update/archive/restore", () => {
    it("checks ownership before updating", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
      prisma.account.update.mockResolvedValue({ id: "acc-1", name: "Renamed" });

      await service.update("user-1", "acc-1", { name: "Renamed" });

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1" },
        data: { name: "Renamed" },
      });
    });

    it("archive sets isArchived true", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
      prisma.account.update.mockResolvedValue({ id: "acc-1", isArchived: true });

      await service.archive("user-1", "acc-1");

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1" },
        data: { isArchived: true },
      });
    });

    it("restore sets isArchived false", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
      prisma.account.update.mockResolvedValue({ id: "acc-1", isArchived: false });

      await service.restore("user-1", "acc-1");

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1" },
        data: { isArchived: false },
      });
    });
  });

  describe("remove", () => {
    it("deletes when there are no references", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
      prisma.account.delete.mockResolvedValue({ id: "acc-1" });

      await service.remove("user-1", "acc-1");

      expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: "acc-1" } });
    });

    it("converts a foreign key violation into a ConflictException", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue({ id: "acc-1", userId: "user-1" });
      prisma.account.delete.mockRejectedValue(fkViolationError());

      await expect(service.remove("user-1", "acc-1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects deleting another user's account", async () => {
      const { service, prisma } = buildAccountsService();
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.remove("user-1", "acc-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.account.delete).not.toHaveBeenCalled();
    });
  });
});
