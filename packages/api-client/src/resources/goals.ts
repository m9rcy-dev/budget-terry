import type { SavingsGoal } from "@budget-terry/types";
import type {
  CreateGoalContributionInput,
  CreateGoalInput,
  UpdateGoalInput,
} from "@budget-terry/validation";
import type { ApiClient } from "../client";

export function listGoals(
  client: ApiClient,
  options?: { includeArchived?: boolean },
): Promise<SavingsGoal[]> {
  const query = options?.includeArchived ? "?includeArchived=true" : "";
  return client.request<SavingsGoal[]>(`/goals${query}`);
}

export function getGoal(client: ApiClient, id: string): Promise<SavingsGoal> {
  return client.request<SavingsGoal>(`/goals/${id}`);
}

export function createGoal(client: ApiClient, input: CreateGoalInput): Promise<SavingsGoal> {
  return client.request<SavingsGoal>("/goals", { method: "POST", body: input });
}

export function updateGoal(
  client: ApiClient,
  id: string,
  input: UpdateGoalInput,
): Promise<SavingsGoal> {
  return client.request<SavingsGoal>(`/goals/${id}`, { method: "PATCH", body: input });
}

export function addGoalContribution(
  client: ApiClient,
  id: string,
  input: CreateGoalContributionInput,
): Promise<SavingsGoal> {
  return client.request<SavingsGoal>(`/goals/${id}/contributions`, { method: "POST", body: input });
}

export function completeGoal(client: ApiClient, id: string): Promise<SavingsGoal> {
  return client.request<SavingsGoal>(`/goals/${id}/complete`, { method: "POST" });
}

export function archiveGoal(client: ApiClient, id: string): Promise<SavingsGoal> {
  return client.request<SavingsGoal>(`/goals/${id}/archive`, { method: "POST" });
}

export function restoreGoal(client: ApiClient, id: string): Promise<SavingsGoal> {
  return client.request<SavingsGoal>(`/goals/${id}/restore`, { method: "POST" });
}
