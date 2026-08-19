import { z } from "zod";
import { currencyCodeSchema, minorUnitsSchema } from "./money";

/**
 * Only INCOME/EXPENSE for now — TRANSFER is deliberately out of scope
 * for Phase 5 (plan Section 18: transfers need dedicated linked-entry
 * handling later so they don't get counted as spending).
 */
export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

/** Date only, never a timestamp — see plan Section 51. */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema,
  amountMinorUnits: minorUnitsSchema,
  currency: currencyCodeSchema.default("NZD"),
  transactionDate: isoDateSchema,
  merchant: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  search: z.string().max(200).optional(),
});

export const categoryTotalsQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type CategoryTotalsQuery = z.infer<typeof categoryTotalsQuerySchema>;
