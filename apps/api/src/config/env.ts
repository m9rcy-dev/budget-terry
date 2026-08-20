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
