import { z } from "zod";
import { isoDateSchema } from "./date";

/**
 * Both bounds optional — when omitted, the API defaults to the start of
 * the current calendar month through today. No Budget-defined period
 * exists yet (that's Phase 7's anchored periods per ADR-006); calendar
 * month is a deliberate, simple placeholder until then.
 */
export const dashboardSummaryQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
