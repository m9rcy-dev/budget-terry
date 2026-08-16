import type { CurrencyCode } from "./money";

export type AccountType = "EVERYDAY" | "SAVINGS" | "CREDIT_CARD" | "CASH" | "OTHER";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  isArchived: boolean;
}
