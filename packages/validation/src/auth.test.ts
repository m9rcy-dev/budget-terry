import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    const result = registerSchema.safeParse({
      email: "person@example.com",
      password: "a-long-enough-password",
      displayName: "Terry",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 12 characters", () => {
    const result = registerSchema.safeParse({
      email: "person@example.com",
      password: "short1",
      displayName: "Terry",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      email: "not-an-email",
      password: "a-long-enough-password",
      displayName: "Terry",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts email and a non-empty password", () => {
    const result = loginSchema.safeParse({ email: "person@example.com", password: "x" });

    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "person@example.com", password: "" });

    expect(result.success).toBe(false);
  });
});
