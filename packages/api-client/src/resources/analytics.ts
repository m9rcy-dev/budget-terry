import type { AnalyticsSummary } from "@budget-terry/types";
import type { AnalyticsQuery } from "@budget-terry/validation";
import type { ApiClient } from "../client";

export function getAnalyticsSummary(
  client: ApiClient,
  query: AnalyticsQuery,
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.limit !== undefined) params.set("limit", String(query.limit));

  return client.request<AnalyticsSummary>(`/analytics/summary?${params.toString()}`);
}
