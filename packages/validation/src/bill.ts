import { z } from "zod";
import { isoDateSchema } from "./date";
import { currencyCodeSchema, minorUnitsSchema } from "./money";

export const billRecurrenceSchema = z.enum([
  "ONE_OFF",
  "WEEKLY",
  "FORTNIGHTLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
]);

export const createBillSchema = z.object({
  name: z.string().min(1).max(100),
  amountMinorUnits: minorUnitsSchema,
  currency: currencyCodeSchema.default("NZD"),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  recurrence: billRecurrenceSchema,
  firstDueDate: isoDateSchema,
  autoPay: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
});

/**
 * Currency, recurrence, and firstDueDate are deliberately not editable
 * here — changing recurrence would require regenerating future
 * occurrences, which is out of scope for this phase (archive the bill
 * and create a new one instead). Same "not editable" precedent as
 * Account.currency.
 */
export const updateBillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  amountMinorUnits: minorUnitsSchema.optional(),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  autoPay: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** accountId is only required if the bill has no default account. */
export const markBillOccurrencePaidSchema = z.object({
  accountId: z.string().uuid().optional(),
});

export type BillRecurrenceInput = z.infer<typeof billRecurrenceSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type MarkBillOccurrencePaidInput = z.infer<typeof markBillOccurrencePaidSchema>;
