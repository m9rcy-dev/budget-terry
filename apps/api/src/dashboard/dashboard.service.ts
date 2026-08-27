import { Injectable } from "@nestjs/common";
import type { Transaction } from "@prisma/client";
import type { CalendarBillEntry } from "@budget-terry/types";
import { BillsService } from "../bills/bills.service";
import { DUE_SOON_WINDOW_DAYS } from "../bills/bill-recurrence";
import { addUtcDays } from "../common/date-utils";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionsService, type CategoryTotal } from "../transactions/transactions.service";

export interface DashboardSummary {
  period: { from: string; to: string };
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  netMinorUnits: number;
  categoryTotals: CategoryTotal[];
  recentTransactions: Transaction[];
  upcomingBills: CalendarBillEntry[];
}

const RECENT_TRANSACTIONS_COUNT = 5;
const UPCOMING_BILLS_COUNT = 5;

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
    private readonly billsService: BillsService,
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
    const now = new Date();

    const [incomeMinorUnits, expensesMinorUnits, categoryTotals, recent, upcomingOccurrences] =
      await Promise.all([
        this.sumByType(userId, "INCOME", rangeFrom, rangeTo),
        this.sumByType(userId, "EXPENSE", rangeFrom, rangeTo),
        this.transactionsService.getCategoryTotals(userId, rangeFrom, rangeTo),
        this.transactionsService.findAllForUser(userId, {
          page: 1,
          pageSize: RECENT_TRANSACTIONS_COUNT,
        }),
        this.billsService.findOccurrencesDueInRange(
          userId,
          now,
          addUtcDays(now, DUE_SOON_WINDOW_DAYS),
        ),
      ]);

    const upcomingBills: CalendarBillEntry[] = upcomingOccurrences
      .filter(
        (occurrence) =>
          occurrence.displayStatus !== "PAID" && occurrence.displayStatus !== "SKIPPED",
      )
      .slice(0, UPCOMING_BILLS_COUNT)
      .map((occurrence) => ({
        type: "BILL",
        date: occurrence.dueDate.toISOString().slice(0, 10),
        billId: occurrence.billId,
        occurrenceId: occurrence.occurrenceId,
        name: occurrence.billName,
        accountId: occurrence.billAccountId,
        amountMinorUnits: occurrence.amountMinorUnits,
        currency: occurrence.currency,
        displayStatus: occurrence.displayStatus,
      }));

    return {
      period: { from: rangeFrom, to: rangeTo },
      incomeMinorUnits,
      expensesMinorUnits,
      netMinorUnits: incomeMinorUnits - expensesMinorUnits,
      categoryTotals,
      recentTransactions: recent.items,
      upcomingBills,
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
