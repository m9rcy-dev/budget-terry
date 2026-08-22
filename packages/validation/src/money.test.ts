import { describe, expect, it } from "vitest";
import { moneySchema } from "./money";

describe("moneySchema", () => {
  it("accepts an integer minor-units amount with a known currency", () => {
    const result = moneySchema.safeParse({ amountMinorUnits: 1234, currency: "NZD" });

    expect(result.success).toBe(true);
  });

  it("rejects a non-integer amount", () => {
    const result = moneySchema.safeParse({ amountMinorUnits: 12.34, currency: "NZD" });

    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = moneySchema.safeParse({ amountMinorUnits: -100, currency: "NZD" });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown currency", () => {
    const result = moneySchema.safeParse({ amountMinorUnits: 100, currency: "GBP" });

    expect(result.success).toBe(false);
  });
});
