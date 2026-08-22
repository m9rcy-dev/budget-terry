import type { CurrencyCode } from "./money";

export type TransactionType = "INCOME" | "EXPENSE";

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amountMinorUnits: number;
  currency: CurrencyCode;
  transactionDate: string;
  merchant: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  totalMinorUnits: number;
}
