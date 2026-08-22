import { describe, expect, it } from "vitest";
import { createBudgetSchema } from "./budget";

const base = { period: "MONTHLY" as const, anchorDate: "2026-08-01" };

describe("createBudgetSchema", () => {
  it("accepts an overall budget", () => {
    const result = createBudgetSchema.safeParse({ ...base, totalAmountMinorUnits: 100000 });
    expect(result.success).toBe(true);
  });

  it("accepts a per-category budget", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      categoryAllocations: [
        { categoryId: "550e8400-e29b-41d4-a716-446655440000", amountMinorUnits: 50000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects providing both totalAmountMinorUnits and categoryAllocations", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      totalAmountMinorUnits: 100000,
      categoryAllocations: [
        { categoryId: "550e8400-e29b-41d4-a716-446655440000", amountMinorUnits: 50000 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects providing neither", () => {
    const result = createBudgetSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects an empty categoryAllocations array (counts as neither)", () => {
    const result = createBudgetSchema.safeParse({ ...base, categoryAllocations: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate categoryId within categoryAllocations", () => {
    const result = createBudgetSchema.safeParse({
      ...base,
      categoryAllocations: [
        { categoryId: "550e8400-e29b-41d4-a716-446655440000", amountMinorUnits: 10000 },
        { categoryId: "550e8400-e29b-41d4-a716-446655440000", amountMinorUnits: 20000 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
