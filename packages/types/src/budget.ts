import type { CurrencyCode } from "./money";

export type BudgetPeriodType = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
export type BudgetStatus = "HEALTHY" | "APPROACHING" | "EXCEEDED";

export interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  amountMinorUnits: number;
  spentMinorUnits: number;
  remainingMinorUnits: number;
  percentageUsed: number;
  status: BudgetStatus;
}

/**
 * Overall and per-category fields are mutually exclusive, mirroring the
 * Budget entity's own XOR invariant — `categories` is always an array
 * (empty for overall budgets), while the overall fields are null for
 * per-category budgets.
 */
export interface Budget {
  id: string;
  name: string | null;
  period: BudgetPeriodType;
  anchorDate: string;
  currency: CurrencyCode;
  currentPeriod: { start: string; end: string };
  totalAmountMinorUnits: number | null;
  spentMinorUnits: number | null;
  remainingMinorUnits: number | null;
  percentageUsed: number | null;
  status: BudgetStatus | null;
  categories: BudgetCategoryStatus[];
}
