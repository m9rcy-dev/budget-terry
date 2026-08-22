import { describe, expect, it } from "vitest";
import { createGoalContributionSchema, createGoalSchema, updateGoalSchema } from "./goal";

describe("createGoalSchema", () => {
  const base = { name: "Japan Holiday", targetAmountMinorUnits: 800000 };

  it("accepts a minimal goal, defaulting currency to NZD", () => {
    const result = createGoalSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.success && result.data.currency).toBe("NZD");
  });

  it("accepts a goal with an optional targetDate, account, and notes", () => {
    const result = createGoalSchema.safeParse({
      ...base,
      targetDate: "2027-10-01",
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      notes: "Save hard",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createGoalSchema.safeParse({ ...base, name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a negative target amount", () => {
    const result = createGoalSchema.safeParse({ ...base, targetAmountMinorUnits: -100 });

    expect(result.success).toBe(false);
  });
});

describe("updateGoalSchema", () => {
  it("allows a partial update with no fields", () => {
    const result = updateGoalSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("does not accept a currency field", () => {
    const result = updateGoalSchema.safeParse({ name: "Renamed", currency: "USD" });

    expect(result.success).toBe(true);
    expect(result.success && "currency" in result.data).toBe(false);
  });

  it("allows explicitly clearing targetDate to null", () => {
    const result = updateGoalSchema.safeParse({ targetDate: null });

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetDate).toBeNull();
  });
});

describe("createGoalContributionSchema", () => {
  it("accepts a contribution with just an amount", () => {
    const result = createGoalContributionSchema.safeParse({ amountMinorUnits: 25000 });

    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = createGoalContributionSchema.safeParse({ amountMinorUnits: -1 });

    expect(result.success).toBe(false);
  });
});
