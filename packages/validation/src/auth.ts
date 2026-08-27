import { z } from "zod";

/**
 * Minimum length only, no forced complexity rules — OWASP's current
 * guidance favors length over composition requirements.
 */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, "Password must be at least 12 characters"),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const requestLoginCodeSchema = z.object({
  email: z.string().email(),
});

export const verifyLoginCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  /** Opt-in — issues a long-lived device trust token that skips this
   * emailed-code step on future logins from the same device. See
   * docs/trusted-device-plan.md. */
  rememberDevice: z.boolean().optional(),
});

/** Presents a previously-issued device trust token to sign in without a
 * login code — the trusted-device equivalent of a refresh token. */
export const deviceLoginSchema = z.object({
  deviceTrustToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestLoginCodeInput = z.infer<typeof requestLoginCodeSchema>;
export type VerifyLoginCodeInput = z.infer<typeof verifyLoginCodeSchema>;
export type DeviceLoginInput = z.infer<typeof deviceLoginSchema>;
