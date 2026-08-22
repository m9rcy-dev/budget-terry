import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { CategoriesService } from "./categories.service";

function buildCategoriesService() {
  const prisma = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const service = new CategoriesService(prisma as unknown as PrismaService);
  return { service, prisma };
}

function fkViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Foreign key constraint violated", {
    code: "P2003",
    clientVersion: "test",
  });
}

function uniqueViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint violated", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("CategoriesService", () => {
  describe("create", () => {
    it("converts a duplicate name into a ConflictException", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.create.mockRejectedValue(uniqueViolationError());

      await expect(service.create("user-1", { name: "Groceries" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe("findAllForUser", () => {
    it("excludes archived categories by default", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findMany.mockResolvedValue([]);

      await service.findAllForUser("user-1", false);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", isArchived: false },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("findOneForUser", () => {
    it("throws NotFoundException when the category doesn't exist or belongs to another user", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.findOneForUser("user-1", "cat-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("renames regardless of archive status", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", userId: "user-1" });
      prisma.category.update.mockResolvedValue({ id: "cat-1", name: "Restaurants" });

      await service.update("user-1", "cat-1", { name: "Restaurants" });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { name: "Restaurants" },
      });
    });

    it("converts renaming to an existing name into a ConflictException", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", userId: "user-1" });
      prisma.category.update.mockRejectedValue(uniqueViolationError());

      await expect(service.update("user-1", "cat-1", { name: "Groceries" })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    it("deletes when there are no references", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", userId: "user-1" });
      prisma.category.delete.mockResolvedValue({ id: "cat-1" });

      await service.remove("user-1", "cat-1");

      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
    });

    it("converts a foreign key violation into a ConflictException", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findFirst.mockResolvedValue({ id: "cat-1", userId: "user-1" });
      prisma.category.delete.mockRejectedValue(fkViolationError());

      await expect(service.remove("user-1", "cat-1")).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects deleting another user's category", async () => {
      const { service, prisma } = buildCategoriesService();
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove("user-1", "cat-1")).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });
  });
});
