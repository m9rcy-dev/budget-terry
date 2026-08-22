import { z } from "zod";
import { isoDateSchema } from "./date";

/**
 * Both bounds are required, unlike the dashboard's optional from/to —
 * a calendar view (month/week/agenda) always has a concrete range it's
 * displaying, so there's no natural "current period" default to fall
 * back to the way the dashboard falls back to the calendar month.
 */
export const calendarQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
