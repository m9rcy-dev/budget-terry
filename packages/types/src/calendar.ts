import type { BillDisplayStatus } from "./bill";
import type { CurrencyCode } from "./money";

export interface CalendarBillEntry {
  type: "BILL";
  date: string;
  billId: string;
  occurrenceId: string;
  name: string;
  accountId: string | null;
  amountMinorUnits: number;
  currency: CurrencyCode;
  displayStatus: BillDisplayStatus;
}

export interface CalendarIncomeEntry {
  type: "INCOME";
  date: string;
  transactionId: string;
  amountMinorUnits: number;
  currency: CurrencyCode;
  merchant: string | null;
  description: string | null;
}

export interface CalendarSavingsContributionEntry {
  type: "SAVINGS_CONTRIBUTION";
  date: string;
  goalId: string;
  contributionId: string;
  goalName: string;
  amountMinorUnits: number;
  currency: CurrencyCode;
}

export type CalendarEntry =
  CalendarBillEntry | CalendarIncomeEntry | CalendarSavingsContributionEntry;
