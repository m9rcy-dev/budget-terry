import { z } from "zod";
import { isoDateSchema } from "./date";
import { currencyCodeSchema, minorUnitsSchema } from "./money";

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmountMinorUnits: minorUnitsSchema,
  currency: currencyCodeSchema.default("NZD"),
  targetDate: isoDateSchema.optional(),
  accountId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

/** Currency is deliberately not editable here — same precedent as Account.currency. */
export const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetAmountMinorUnits: minorUnitsSchema.optional(),
  targetDate: isoDateSchema.nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** accountId is only required if the goal has no default account. */
export const createGoalContributionSchema = z.object({
  amountMinorUnits: minorUnitsSchema,
  contributionDate: isoDateSchema.optional(),
  accountId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateGoalContributionInput = z.infer<typeof createGoalContributionSchema>;
