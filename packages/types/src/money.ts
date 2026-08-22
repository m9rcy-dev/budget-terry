/**
 * Always an integer count of the currency's smallest unit (e.g. cents).
 * Never a float — see ADR-002.
 */
export type MinorUnits = number;

/**
 * Currencies Budget Terry can represent. NZD is the default (ADR-002);
 * others are modeled now so the schema doesn't need a later migration,
 * even though conversion between currencies is out of scope for MVP.
 */
export type CurrencyCode = "NZD" | "AUD" | "USD" | "EUR";

export interface Money {
  amountMinorUnits: MinorUnits;
  currency: CurrencyCode;
}
