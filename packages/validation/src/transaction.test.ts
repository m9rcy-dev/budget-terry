import { describe, expect, it } from "vitest";
import {
  categoryTotalsQuerySchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
} from "./transaction";

describe("createTransactionSchema", () => {
  it("accepts a valid expense", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      categoryId: "550e8400-e29b-41d4-a716-446655440001",
      type: "EXPENSE",
      amountMinorUnits: 1234,
      transactionDate: "2026-08-19",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.currency).toBe("NZD");
  });

  it("rejects TRANSFER — out of scope for Phase 5", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      type: "TRANSFER",
      amountMinorUnits: 1234,
      transactionDate: "2026-08-19",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO date", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
      type: "EXPENSE",
      amountMinorUnits: 1234,
      transactionDate: "19/08/2026",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing accountId", () => {
    const result = createTransactionSchema.safeParse({
      type: "EXPENSE",
      amountMinorUnits: 1234,
      transactionDate: "2026-08-19",
    });

    expect(result.success).toBe(false);
  });
});

describe("listTransactionsQuerySchema", () => {
  it("defaults page and pageSize", () => {
    const result = listTransactionsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.success && result.data.page).toBe(1);
    expect(result.success && result.data.pageSize).toBe(20);
  });

  it("coerces string query params to numbers", () => {
    const result = listTransactionsQuerySchema.safeParse({ page: "2", pageSize: "50" });

    expect(result.success).toBe(true);
    expect(result.success && result.data.page).toBe(2);
    expect(result.success && result.data.pageSize).toBe(50);
  });

  it("rejects a pageSize above 100", () => {
    const result = listTransactionsQuerySchema.safeParse({ pageSize: "500" });

    expect(result.success).toBe(false);
  });
});

describe("categoryTotalsQuerySchema", () => {
  it("requires both from and to", () => {
    expect(categoryTotalsQuerySchema.safeParse({ from: "2026-08-01" }).success).toBe(false);
    expect(
      categoryTotalsQuerySchema.safeParse({ from: "2026-08-01", to: "2026-08-31" }).success,
    ).toBe(true);
  });
});
