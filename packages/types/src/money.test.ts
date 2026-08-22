import { describe, expect, it } from "vitest";
import type { Money } from "./money";

describe("Money", () => {
  it("represents an amount as integer minor units with an explicit currency", () => {
    const price: Money = { amountMinorUnits: 1234, currency: "NZD" };

    expect(Number.isInteger(price.amountMinorUnits)).toBe(true);
    expect(price.currency).toBe("NZD");
  });
});
