import { z } from "zod";
import { isoDateSchema } from "./date";
import { currencyCodeSchema, minorUnitsSchema } from "./money";

export const budgetPeriodSchema = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]);

export const budgetCategoryAllocationSchema = z.object({
  categoryId: z.string().uuid(),
  amountMinorUnits: minorUnitsSchema,
});

/**
 * A budget is either an overall cap (totalAmountMinorUnits) or a
 * per-category allocation (categoryAllocations) — never both, never
 * neither. This is the service-layer invariant from ADR-002/the data
 * model docs, enforced here at the API boundary rather than only in
 * application code.
 */
export const createBudgetSchema = z
  .object({
    name: z.string().max(100).optional(),
    period: budgetPeriodSchema,
    anchorDate: isoDateSchema,
    currency: currencyCodeSchema.default("NZD"),
    totalAmountMinorUnits: minorUnitsSchema.optional(),
    categoryAllocations: z.array(budgetCategoryAllocationSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const hasTotal = data.totalAmountMinorUnits !== undefined;
    const hasCategories = (data.categoryAllocations?.length ?? 0) > 0;

    if (hasTotal === hasCategories) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide either totalAmountMinorUnits (overall budget) or categoryAllocations (per-category budget), not both or neither.",
        path: ["totalAmountMinorUnits"],
      });
    }

    if (data.categoryAllocations) {
      const ids = data.categoryAllocations.map((allocation) => allocation.categoryId);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "categoryAllocations contains a duplicate categoryId.",
          path: ["categoryAllocations"],
        });
      }
    }
  });

/**
 * Editing a budget resubmits the full shape rather than a partial patch —
 * amounts are structurally XOR'd, so a partial update would leave the
 * invariant ambiguous (are you clearing the total, or leaving it
 * untouched?). Simpler to always replace period/anchor/currency/amounts
 * together; only `name` is optional.
 */
export const updateBudgetSchema = createBudgetSchema;

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type BudgetCategoryAllocation = z.infer<typeof budgetCategoryAllocationSchema>;
