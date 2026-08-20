export interface TransactionForBucketing {
  type: "INCOME" | "EXPENSE";
  amountMinorUnits: number;
  transactionDate: Date;
}

export interface MonthlyTotal {
  /** `YYYY-MM`, derived in UTC to match how transactionDate is stored (date-only). */
  month: string;
  incomeMinorUnits: number;
  expensesMinorUnits: number;
}

function monthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/**
 * Groups transactions into per-month income/expense sums — one pass
 * serves both the "spending by month" and "income vs expenses" reports,
 * since spending-by-month is just the expense side of this same
 * aggregation (see AnalyticsService). Sparse: only months with at least
 * one transaction appear, sorted ascending.
 */
export function bucketByMonth(transactions: TransactionForBucketing[]): MonthlyTotal[] {
  const buckets = new Map<string, MonthlyTotal>();

  for (const transaction of transactions) {
    const key = monthKey(transaction.transactionDate);
    const bucket = buckets.get(key) ?? { month: key, incomeMinorUnits: 0, expensesMinorUnits: 0 };
    if (transaction.type === "INCOME") {
      bucket.incomeMinorUnits += transaction.amountMinorUnits;
    } else {
      bucket.expensesMinorUnits += transaction.amountMinorUnits;
    }
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}
