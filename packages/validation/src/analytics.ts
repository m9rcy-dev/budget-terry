import { z } from "zod";
import { isoDateSchema } from "./date";

/**
 * `from`/`to` are required, same reasoning as the calendar's query — a
 * report always has a concrete range it's summarizing, no natural
 * default to fall back to. `accountId`/`categoryId` narrow the
 * transaction-derived sections only (spendingByMonth, incomeVsExpenses,
 * highestExpenseCategories, and spendingByCategory's accountId); the
 * snapshot sections (budgetVsActual, goalProgress,
 * recurringExpenseSummary) ignore them — they aren't transaction-scoped.
 */
export const analyticsQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
