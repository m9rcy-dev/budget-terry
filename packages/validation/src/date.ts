import { z } from "zod";

/** Date only, never a timestamp — see plan Section 51. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");
