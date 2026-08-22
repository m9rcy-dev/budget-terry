import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, requestLoginCodeSchema, verifyLoginCodeSchema } from "./auth";

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

describe("requestLoginCodeSchema", () => {
  it("accepts a valid email", () => {
    expect(requestLoginCodeSchema.safeParse({ email: "person@example.com" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(requestLoginCodeSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("verifyLoginCodeSchema", () => {
  it("accepts an email and a 6-digit code", () => {
    const result = verifyLoginCodeSchema.safeParse({
      email: "person@example.com",
      code: "042817",
    });

    expect(result.success).toBe(true);
  });

  it.each(["1234", "1234567", "12345a", ""])("rejects a malformed code %j", (code) => {
    const result = verifyLoginCodeSchema.safeParse({ email: "person@example.com", code });

    expect(result.success).toBe(false);
  });
});
