import { Injectable } from "@nestjs/common";
import type { CalendarEntry } from "@budget-terry/types";
import type { CalendarQuery } from "@budget-terry/validation";
import { BillsService } from "../bills/bills.service";
import { GoalsService } from "../goals/goals.service";
import { TransactionsService } from "../transactions/transactions.service";

@Injectable()
export class CalendarService {
  constructor(
    private readonly billsService: BillsService,
    private readonly transactionsService: TransactionsService,
    private readonly goalsService: GoalsService,
  ) {}

  /**
   * Composes bill occurrences, income transactions, and savings
   * contributions into a single flat, date-sorted list — the calendar
   * month/week/agenda views are a client-side rendering concern over the
   * same data, not different backend queries (same "one source, multiple
   * presentations" approach the dashboard uses).
   */
  async getEntries(userId: string, query: CalendarQuery): Promise<CalendarEntry[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    const [occurrences, incomeTransactions, contributions] = await Promise.all([
      this.billsService.findOccurrencesDueInRange(userId, from, to),
      this.transactionsService.findIncomeInRange(userId, from, to),
      this.goalsService.findContributionsInRange(userId, from, to),
    ]);

    const billEntries: CalendarEntry[] = occurrences.map((occurrence) => ({
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

    const incomeEntries: CalendarEntry[] = incomeTransactions.map((transaction) => ({
      type: "INCOME",
      date: transaction.transactionDate.toISOString().slice(0, 10),
      transactionId: transaction.id,
      amountMinorUnits: transaction.amountMinorUnits,
      currency: transaction.currency,
      merchant: transaction.merchant,
      description: transaction.description,
    }));

    const contributionEntries: CalendarEntry[] = contributions.map((contribution) => ({
      type: "SAVINGS_CONTRIBUTION",
      date: contribution.contributionDate.toISOString().slice(0, 10),
      goalId: contribution.goalId,
      contributionId: contribution.contributionId,
      goalName: contribution.goalName,
      amountMinorUnits: contribution.amountMinorUnits,
      currency: contribution.currency,
    }));

    return [...billEntries, ...incomeEntries, ...contributionEntries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }
}
