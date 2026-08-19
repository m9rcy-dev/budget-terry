import { Injectable, NotFoundException } from "@nestjs/common";
import type { Budget, BudgetCategory, Category } from "@prisma/client";
import type { BudgetStatus } from "@budget-terry/types";
import type { CreateBudgetInput, UpdateBudgetInput } from "@budget-terry/validation";
import { CategoriesService } from "../categories/categories.service";
import { PrismaService } from "../prisma/prisma.service";
import { computeCurrentPeriod } from "./budget-period";

type BudgetWithCategories = Budget & {
  budgetCategories: (BudgetCategory & { category: Category })[];
};

export interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  amountMinorUnits: number;
  spentMinorUnits: number;
  remainingMinorUnits: number;
  percentageUsed: number;
  status: BudgetStatus;
}

export interface BudgetWithStatus {
  id: string;
  name: string | null;
  period: Budget["period"];
  anchorDate: Date;
  currency: Budget["currency"];
  currentPeriod: { start: Date; end: Date };
  totalAmountMinorUnits: number | null;
  spentMinorUnits: number | null;
  remainingMinorUnits: number | null;
  percentageUsed: number | null;
  status: BudgetStatus | null;
  categories: BudgetCategoryStatus[];
}

/** <80% healthy, 80-99.99% approaching, >=100% exceeded — matches plan Section 72's Terry rule thresholds. */
const APPROACHING_THRESHOLD = 0.8;

function statusFor(spent: number, allocated: number): BudgetStatus {
  if (allocated <= 0) {
    return spent > 0 ? "EXCEEDED" : "HEALTHY";
  }
  const ratio = spent / allocated;
  if (ratio >= 1) {
    return "EXCEEDED";
  }
  if (ratio >= APPROACHING_THRESHOLD) {
    return "APPROACHING";
  }
  return "HEALTHY";
}

function percentageUsedFor(spent: number, allocated: number): number {
  if (allocated <= 0) {
    return spent > 0 ? 100 : 0;
  }
  return Math.round((spent / allocated) * 1000) / 10;
}

const BUDGET_CATEGORIES_INCLUDE = { budgetCategories: { include: { category: true } } } as const;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(userId: string, input: CreateBudgetInput): Promise<BudgetWithStatus> {
    if (input.categoryAllocations) {
      await this.verifyCategoryOwnership(userId, input.categoryAllocations);
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        name: input.name,
        period: input.period,
        anchorDate: new Date(input.anchorDate),
        currency: input.currency,
        totalAmountMinorUnits: input.totalAmountMinorUnits,
        budgetCategories: input.categoryAllocations
          ? {
              create: input.categoryAllocations.map((allocation) => ({
                categoryId: allocation.categoryId,
                amountMinorUnits: allocation.amountMinorUnits,
              })),
            }
          : undefined,
      },
      include: BUDGET_CATEGORIES_INCLUDE,
    });

    return this.attachStatus(budget, new Date());
  }

  async findAllForUser(userId: string): Promise<BudgetWithStatus[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: BUDGET_CATEGORIES_INCLUDE,
    });

    const now = new Date();
    return Promise.all(budgets.map((budget) => this.attachStatus(budget, now)));
  }

  /**
   * Scopes by userId in the query itself, not fetch-then-check — another
   * user's budget is indistinguishable from a nonexistent one. See the
   * critical guarantee in docs/architecture/security.md.
   */
  async findOneForUser(userId: string, id: string): Promise<BudgetWithStatus> {
    const budget = await this.findOwned(userId, id);
    return this.attachStatus(budget, new Date());
  }

  async update(userId: string, id: string, input: UpdateBudgetInput): Promise<BudgetWithStatus> {
    await this.findOwned(userId, id);
    if (input.categoryAllocations) {
      await this.verifyCategoryOwnership(userId, input.categoryAllocations);
    }

    const budget = await this.prisma.$transaction(async (tx) => {
      await tx.budgetCategory.deleteMany({ where: { budgetId: id } });
      return tx.budget.update({
        where: { id },
        data: {
          name: input.name,
          period: input.period,
          anchorDate: new Date(input.anchorDate),
          currency: input.currency,
          totalAmountMinorUnits: input.totalAmountMinorUnits ?? null,
          budgetCategories: input.categoryAllocations
            ? {
                create: input.categoryAllocations.map((allocation) => ({
                  categoryId: allocation.categoryId,
                  amountMinorUnits: allocation.amountMinorUnits,
                })),
              }
            : undefined,
        },
        include: BUDGET_CATEGORIES_INCLUDE,
      });
    });

    return this.attachStatus(budget, new Date());
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    // budget_categories cascade-delete with the budget (schema onDelete: Cascade).
    await this.prisma.budget.delete({ where: { id } });
  }

  private async findOwned(userId: string, id: string): Promise<BudgetWithCategories> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      include: BUDGET_CATEGORIES_INCLUDE,
    });
    if (!budget) {
      throw new NotFoundException("Budget was not found.");
    }
    return budget;
  }

  private async verifyCategoryOwnership(
    userId: string,
    allocations: { categoryId: string }[],
  ): Promise<void> {
    for (const allocation of allocations) {
      await this.categoriesService.findOneForUser(userId, allocation.categoryId);
    }
  }

  /**
   * Spent/remaining/percentage/status are always computed on read from
   * live Transaction data, never stored — same principle as
   * SavingsGoal.currentAmountMinorUnits and BillOccurrence's display
   * status elsewhere in the schema (plan Section 55 — avoid premature
   * caching; a stored figure could drift from the transactions it's
   * supposed to summarize).
   */
  private async attachStatus(
    budget: BudgetWithCategories,
    referenceDate: Date,
  ): Promise<BudgetWithStatus> {
    const currentPeriod = computeCurrentPeriod(budget.period, budget.anchorDate, referenceDate);

    if (budget.totalAmountMinorUnits !== null) {
      const spent = await this.sumExpenses(budget.userId, currentPeriod.start, currentPeriod.end);
      return {
        id: budget.id,
        name: budget.name,
        period: budget.period,
        anchorDate: budget.anchorDate,
        currency: budget.currency,
        currentPeriod,
        totalAmountMinorUnits: budget.totalAmountMinorUnits,
        spentMinorUnits: spent,
        remainingMinorUnits: budget.totalAmountMinorUnits - spent,
        percentageUsed: percentageUsedFor(spent, budget.totalAmountMinorUnits),
        status: statusFor(spent, budget.totalAmountMinorUnits),
        categories: [],
      };
    }

    const categories = await Promise.all(
      budget.budgetCategories.map(async (budgetCategory): Promise<BudgetCategoryStatus> => {
        const spent = await this.sumExpenses(
          budget.userId,
          currentPeriod.start,
          currentPeriod.end,
          budgetCategory.categoryId,
        );
        return {
          categoryId: budgetCategory.categoryId,
          categoryName: budgetCategory.category.name,
          amountMinorUnits: budgetCategory.amountMinorUnits,
          spentMinorUnits: spent,
          remainingMinorUnits: budgetCategory.amountMinorUnits - spent,
          percentageUsed: percentageUsedFor(spent, budgetCategory.amountMinorUnits),
          status: statusFor(spent, budgetCategory.amountMinorUnits),
        };
      }),
    );

    return {
      id: budget.id,
      name: budget.name,
      period: budget.period,
      anchorDate: budget.anchorDate,
      currency: budget.currency,
      currentPeriod,
      totalAmountMinorUnits: null,
      spentMinorUnits: null,
      remainingMinorUnits: null,
      percentageUsed: null,
      status: null,
      categories,
    };
  }

  private async sumExpenses(
    userId: string,
    start: Date,
    end: Date,
    categoryId?: string,
  ): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        userId,
        type: "EXPENSE",
        transactionDate: { gte: start, lte: end },
        ...(categoryId ? { categoryId } : {}),
      },
      _sum: { amountMinorUnits: true },
    });
    return result._sum.amountMinorUnits ?? 0;
  }
}
