import type { CategoryTotal, Transaction } from "./transaction";

export interface DashboardSummary {
  period: { from: string; to: string };
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  netMinorUnits: number;
  categoryTotals: CategoryTotal[];
  recentTransactions: Transaction[];
}
