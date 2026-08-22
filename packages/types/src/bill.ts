import type { CurrencyCode } from "./money";

export type BillRecurrenceType =
  "ONE_OFF" | "WEEKLY" | "FORTNIGHTLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export type BillPaymentStatus = "PENDING" | "PAID" | "SKIPPED";

/**
 * PAID/SKIPPED mirror BillOccurrence.paymentStatus directly. The other
 * four are computed at read time from dueDate vs. today — see ADR-010.
 */
export type BillDisplayStatus =
  "UPCOMING" | "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | "PAID" | "SKIPPED";

export interface BillOccurrence {
  id: string;
  billId: string;
  dueDate: string;
  amountMinorUnits: number;
  currency: CurrencyCode;
  paymentStatus: BillPaymentStatus;
  displayStatus: BillDisplayStatus;
  paidAt: string | null;
  relatedTransactionId: string | null;
}

export interface Bill {
  id: string;
  name: string;
  amountMinorUnits: number;
  currency: CurrencyCode;
  categoryId: string | null;
  accountId: string | null;
  recurrence: BillRecurrenceType;
  autoPay: boolean;
  notes: string | null;
  isArchived: boolean;
  occurrences: BillOccurrence[];
}
