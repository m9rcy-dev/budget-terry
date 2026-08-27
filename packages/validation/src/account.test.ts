import { describe, expect, it } from "vitest";
import { createAccountSchema, updateAccountSchema } from "./account";

describe("createAccountSchema", () => {
  it("accepts a valid account, defaulting currency to NZD", () => {
    const result = createAccountSchema.safeParse({ name: "Everyday", type: "CHEQUE" });

    expect(result.success).toBe(true);
    expect(result.success && result.data.currency).toBe("NZD");
  });

  it("rejects an unknown account type", () => {
    const result = createAccountSchema.safeParse({ name: "Everyday", type: "CRYPTO_WALLET" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createAccountSchema.safeParse({ name: "", type: "CHEQUE" });

    expect(result.success).toBe(false);
  });
});

describe("updateAccountSchema", () => {
  it("does not accept a currency field", () => {
    const result = updateAccountSchema.safeParse({ name: "Renamed", currency: "USD" });

    expect(result.success).toBe(true);
    // currency is silently stripped, not an error — zod objects drop unknown keys by default.
    expect(result.success && "currency" in result.data).toBe(false);
  });

  it("allows a partial update with no fields", () => {
    const result = updateAccountSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});
