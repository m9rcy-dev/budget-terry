import type { BillDisplayStatus } from "./bill";
import type { CurrencyCode } from "./money";

export interface CalendarBillEntry {
  type: "BILL";
  date: string;
  billId: string;
  occurrenceId: string;
  name: string;
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

/**
 * Savings contributions (plan Section 6's "Optional savings
 * contributions") aren't included yet — GoalContribution doesn't exist
 * until Phase 10. Revisit once it does.
 */
export type CalendarEntry = CalendarBillEntry | CalendarIncomeEntry;
