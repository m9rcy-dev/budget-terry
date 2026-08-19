import type { DashboardSummary } from "@budget-terry/types";
import type { ApiClient } from "../client";

export function getDashboardSummary(
  client: ApiClient,
  range: { from?: string; to?: string } = {},
): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  if (range.from) {
    params.set("from", range.from);
  }
  if (range.to) {
    params.set("to", range.to);
  }
  const query = params.toString();
  return client.request<DashboardSummary>(`/dashboard/summary${query ? `?${query}` : ""}`);
}
