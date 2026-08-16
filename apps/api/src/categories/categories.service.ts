import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Category } from "@prisma/client";
import type { CreateCategoryInput, UpdateCategoryInput } from "@budget-terry/validation";
import { isForeignKeyViolation, isUniqueConstraintViolation } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    try {
      return await this.prisma.category.create({ data: { userId, name: input.name } });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException("You already have a category with this name.");
      }
      throw error;
    }
  }

  findAllForUser(userId: string, includeArchived: boolean): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Scopes by userId in the query itself, not fetch-then-check — another
   * user's category is indistinguishable from a nonexistent one. See the
   * critical guarantee in docs/architecture/security.md.
   */
  async findOneForUser(userId: string, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) {
      throw new NotFoundException("Category was not found.");
    }
    return category;
  }

  /** Renaming is always allowed, regardless of transaction history — see ADR-008. */
  async update(userId: string, id: string, input: UpdateCategoryInput): Promise<Category> {
    await this.findOneForUser(userId, id);

    try {
      return await this.prisma.category.update({ where: { id }, data: { name: input.name } });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException("You already have a category with this name.");
      }
      throw error;
    }
  }

  async archive(userId: string, id: string): Promise<Category> {
    await this.findOneForUser(userId, id);
    return this.prisma.category.update({ where: { id }, data: { isArchived: true } });
  }

  async restore(userId: string, id: string): Promise<Category> {
    await this.findOneForUser(userId, id);
    return this.prisma.category.update({ where: { id }, data: { isArchived: false } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneForUser(userId, id);

    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          "This category is used by existing transactions, budgets, or bills and can't be deleted — archive it instead.",
        );
      }
      throw error;
    }
  }
}
