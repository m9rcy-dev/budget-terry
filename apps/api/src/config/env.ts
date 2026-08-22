import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  /** Signs access tokens (ADR-011). Must be long/random — never a short guessable string. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  /** CORS origin for the web app (ADR-009: web and API are on different origins). */
  WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Selects the MailProvider implementation — see src/mail/mail.module.ts. */
  MAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  /** SMTP transport config — Mailpit locally (no auth). Only read when
   * MAIL_PROVIDER=smtp. */
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  /** Resend's HTTP API key. Only read when MAIL_PROVIDER=resend (production). */
  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().min(1).default("Budget Terry <no-reply@budgetterry.local>"),
  /** Login-code emails expire after this many minutes (plan: 6-digit
   * passwordless login). */
  LOGIN_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Fails startup immediately with a clear message if required configuration
 * is missing or malformed, rather than surfacing confusing errors later at
 * request time. See plan Section 41.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
