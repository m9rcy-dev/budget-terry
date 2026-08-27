import type { CurrencyCode } from "./money";

export type AccountType = "CHEQUE" | "SAVINGS" | "CREDIT_CARD" | "OTHER";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  isArchived: boolean;
}
