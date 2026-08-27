import { z } from "zod";
import { currencyCodeSchema } from "./money";

export const accountTypeSchema = z.enum(["CHEQUE", "SAVINGS", "CREDIT_CARD", "OTHER"]);

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: accountTypeSchema,
  currency: currencyCodeSchema.default("NZD"),
});

/**
 * Currency is deliberately not editable — MVP has no multi-currency
 * conversion (ADR-002/plan Section 52), so changing it after creation
 * has no well-defined meaning yet.
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: accountTypeSchema.optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
