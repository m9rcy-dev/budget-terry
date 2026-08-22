import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Transaction } from "@prisma/client";
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from "@budget-terry/validation";
import { AccountsService } from "../accounts/accounts.service";
import { bucketByMonth, type MonthlyTotal } from "../analytics/monthly-bucketing";
import { CategoriesService } from "../categories/categories.service";
import { isUniqueConstraintViolation } from "../common/prisma-errors";
import { PrismaService } from "../prisma/prisma.service";

export interface PaginatedTransactions {
  items: Transaction[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  totalMinorUnits: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Replays an already-seen Idempotency-Key by returning the original
   * transaction instead of creating a duplicate — see ADR-007. The
   * pre-check handles the common case; the catch handles the race where
   * two requests with the same key arrive concurrently (the DB's unique
   * constraint is the real safety net either way).
   */
  async create(
    userId: string,
    input: CreateTransactionInput,
    idempotencyKey?: string,
  ): Promise<Transaction> {
    if (idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      if (existing) {
        return existing;
      }
    }

    // Verifying ownership here (not just trusting the client-supplied id)
    // is what stops user A from posting a transaction against user B's
    // account or category.
    await this.accountsService.findOneForUser(userId, input.accountId);
    if (input.categoryId) {
      await this.categoriesService.findOneForUser(userId, input.categoryId);
    }

    try {
      return await this.prisma.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          categoryId: input.categoryId,
          type: input.type,
          amountMinorUnits: input.amountMinorUnits,
          currency: input.currency,
          transactionDate: new Date(input.transactionDate),
          merchant: input.merchant,
          description: input.description,
          idempotencyKey,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error) && idempotencyKey) {
        return this.prisma.transaction.findUniqueOrThrow({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
      }
      throw error;
    }
  }

  async findAllForUser(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<PaginatedTransactions> {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(query.accountId && { accountId: query.accountId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.type && { type: query.type }),
      ...((query.from || query.to) && {
        transactionDate: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      ...(query.search && {
        OR: [
          { merchant: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { transactionDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  /**
   * Scopes by userId in the query itself, not fetch-then-check — another
   * user's transaction is indistinguishable from a nonexistent one. See
   * the critical guarantee in docs/architecture/security.md.
   */
  async findOneForUser(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!transaction) {
      throw new NotFoundException("Transaction was not found.");
    }
    return transaction;
  }

  async update(userId: string, id: string, input: UpdateTransactionInput): Promise<Transaction> {
    await this.findOneForUser(userId, id);
    if (input.accountId) {
      await this.accountsService.findOneForUser(userId, input.accountId);
    }
    if (input.categoryId) {
      await this.categoriesService.findOneForUser(userId, input.categoryId);
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(input.accountId && { accountId: input.accountId }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.type && { type: input.type }),
        ...(input.amountMinorUnits !== undefined && { amountMinorUnits: input.amountMinorUnits }),
        ...(input.currency && { currency: input.currency }),
        ...(input.transactionDate && { transactionDate: new Date(input.transactionDate) }),
        ...(input.merchant !== undefined && { merchant: input.merchant }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneForUser(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
  }

  /** Income transactions within [from, to] — used by the calendar (Phase 9). */
  async findIncomeInRange(userId: string, from: Date, to: Date): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: { userId, type: "INCOME", transactionDate: { gte: from, lte: to } },
      orderBy: { transactionDate: "asc" },
    });
  }

  async getCategoryTotals(
    userId: string,
    from: string,
    to: string,
    accountId?: string,
  ): Promise<CategoryTotal[]> {
    const totals = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "EXPENSE",
        transactionDate: { gte: new Date(from), lte: new Date(to) },
        ...(accountId && { accountId }),
      },
      _sum: { amountMinorUnits: true },
    });

    const categoryIds = totals
      .map((total) => total.categoryId)
      .filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({ where: { id: { in: categoryIds } } });
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

    return totals.map((total) => ({
      categoryId: total.categoryId ?? "uncategorized",
      categoryName: total.categoryId
        ? (categoryNameById.get(total.categoryId) ?? "Unknown")
        : "Uncategorized",
      totalMinorUnits: total._sum.amountMinorUnits ?? 0,
    }));
  }

  /**
   * Income and expense sums per month within [from, to] — feeds both the
   * "spending by month" and "income vs expenses" analytics reports (see
   * AnalyticsService, which derives spending-by-month as just the
   * expense side of this same result rather than querying twice).
   */
  async getMonthlyTotals(
    userId: string,
    from: string,
    to: string,
    filters: { accountId?: string; categoryId?: string } = {},
  ): Promise<MonthlyTotal[]> {
    // TRANSFER is a defined enum value but deliberately unused by any
    // write path yet (ADR-005/plan Section 18) — filtered explicitly so
    // bucketByMonth's INCOME/EXPENSE-only type stays accurate rather
    // than silently mis-bucketing a future TRANSFER as an expense.
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: { in: ["INCOME", "EXPENSE"] },
        transactionDate: { gte: new Date(from), lte: new Date(to) },
        ...(filters.accountId && { accountId: filters.accountId }),
        ...(filters.categoryId && { categoryId: filters.categoryId }),
      },
      select: { type: true, amountMinorUnits: true, transactionDate: true },
    });

    return bucketByMonth(
      transactions as {
        type: "INCOME" | "EXPENSE";
        amountMinorUnits: number;
        transactionDate: Date;
      }[],
    );
  }
}
