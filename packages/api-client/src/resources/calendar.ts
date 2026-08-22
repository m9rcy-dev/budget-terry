import type { CalendarEntry } from "@budget-terry/types";
import type { ApiClient } from "../client";

export function getCalendarEntries(
  client: ApiClient,
  from: string,
  to: string,
): Promise<CalendarEntry[]> {
  return client.request<CalendarEntry[]>(`/calendar/entries?from=${from}&to=${to}`);
}
