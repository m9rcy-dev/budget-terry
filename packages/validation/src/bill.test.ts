import { describe, expect, it } from "vitest";
import { createBillSchema, markBillOccurrencePaidSchema, updateBillSchema } from "./bill";

describe("createBillSchema", () => {
  const base = {
    name: "Electricity",
    amountMinorUnits: 18400,
    recurrence: "MONTHLY" as const,
    firstDueDate: "2026-09-01",
  };

  it("accepts a valid recurring bill, defaulting currency and autoPay", () => {
    const result = createBillSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.success && result.data.currency).toBe("NZD");
    expect(result.success && result.data.autoPay).toBe(false);
  });

  it("accepts a valid ONE_OFF bill", () => {
    const result = createBillSchema.safeParse({ ...base, recurrence: "ONE_OFF" });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown recurrence value", () => {
    const result = createBillSchema.safeParse({ ...base, recurrence: "DAILY" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing firstDueDate", () => {
    const { firstDueDate, ...withoutDueDate } = base;
    const result = createBillSchema.safeParse(withoutDueDate);

    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createBillSchema.safeParse({ ...base, name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = createBillSchema.safeParse({ ...base, amountMinorUnits: -100 });

    expect(result.success).toBe(false);
  });
});

describe("updateBillSchema", () => {
  it("allows a partial update with no fields", () => {
    const result = updateBillSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("does not accept a recurrence field", () => {
    const result = updateBillSchema.safeParse({ name: "Renamed", recurrence: "WEEKLY" });

    expect(result.success).toBe(true);
    expect(result.success && "recurrence" in result.data).toBe(false);
  });

  it("allows explicitly clearing categoryId to null", () => {
    const result = updateBillSchema.safeParse({ categoryId: null });

    expect(result.success).toBe(true);
    expect(result.success && result.data.categoryId).toBeNull();
  });
});

describe("markBillOccurrencePaidSchema", () => {
  it("allows an empty body", () => {
    const result = markBillOccurrencePaidSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("accepts an explicit accountId", () => {
    const result = markBillOccurrencePaidSchema.safeParse({
      accountId: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(result.success).toBe(true);
  });
});
