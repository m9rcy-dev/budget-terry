import type { CalendarBillEntry } from "./calendar";
import type { CategoryTotal, Transaction } from "./transaction";

export interface DashboardSummary {
  period: { from: string; to: string };
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  netMinorUnits: number;
  categoryTotals: CategoryTotal[];
  recentTransactions: Transaction[];
  /** Pending bill occurrences due within the next week, soonest first. */
  upcomingBills: CalendarBillEntry[];
}
