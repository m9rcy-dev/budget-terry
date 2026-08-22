import { z } from "zod";

/**
 * An amount in integer minor units. Rejects floats and negative values —
 * direction (income vs. expense) is carried by the transaction type, not
 * the sign of the amount. See ADR-002.
 */
export const minorUnitsSchema = z.number().int().nonnegative();

export const currencyCodeSchema = z.enum(["NZD", "AUD", "USD", "EUR"]);

export const moneySchema = z.object({
  amountMinorUnits: minorUnitsSchema,
  currency: currencyCodeSchema,
});
