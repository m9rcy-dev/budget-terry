import { Injectable } from "@nestjs/common";
import type { Transaction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionsService, type CategoryTotal } from "../transactions/transactions.service";

export interface DashboardSummary {
  period: { from: string; to: string };
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  netMinorUnits: number;
  categoryTotals: CategoryTotal[];
  recentTransactions: Transaction[];
}

const RECENT_TRANSACTIONS_COUNT = 5;

/** UTC to avoid timezone drift shifting "today" by a day near midnight. */
function startOfCurrentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * No Budget-defined period exists yet (Phase 7 introduces payday-anchored
   * periods per ADR-006) — defaults to the current calendar month as a
   * simple placeholder when from/to aren't supplied. Revisit once budgets
   * exist so the dashboard can align with the user's actual period.
   */
  async getSummary(userId: string, from?: string, to?: string): Promise<DashboardSummary> {
    const rangeFrom = from ?? startOfCurrentMonth();
    const rangeTo = to ?? today();

    const [incomeMinorUnits, expensesMinorUnits, categoryTotals, recent] = await Promise.all([
      this.sumByType(userId, "INCOME", rangeFrom, rangeTo),
      this.sumByType(userId, "EXPENSE", rangeFrom, rangeTo),
      this.transactionsService.getCategoryTotals(userId, rangeFrom, rangeTo),
      this.transactionsService.findAllForUser(userId, {
        page: 1,
        pageSize: RECENT_TRANSACTIONS_COUNT,
      }),
    ]);

    return {
      period: { from: rangeFrom, to: rangeTo },
      incomeMinorUnits,
      expensesMinorUnits,
      netMinorUnits: incomeMinorUnits - expensesMinorUnits,
      categoryTotals,
      recentTransactions: recent.items,
    };
  }

  private async sumByType(
    userId: string,
    type: "INCOME" | "EXPENSE",
    from: string,
    to: string,
  ): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: { userId, type, transactionDate: { gte: new Date(from), lte: new Date(to) } },
      _sum: { amountMinorUnits: true },
    });
    return result._sum.amountMinorUnits ?? 0;
  }
}
