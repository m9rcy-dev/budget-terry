import type { Budget } from "@budget-terry/types";
import type { CreateBudgetInput, UpdateBudgetInput } from "@budget-terry/validation";
import type { ApiClient } from "../client";

export function listBudgets(client: ApiClient): Promise<Budget[]> {
  return client.request<Budget[]>("/budgets");
}

export function getBudget(client: ApiClient, id: string): Promise<Budget> {
  return client.request<Budget>(`/budgets/${id}`);
}

export function createBudget(client: ApiClient, input: CreateBudgetInput): Promise<Budget> {
  return client.request<Budget>("/budgets", { method: "POST", body: input });
}

export function updateBudget(
  client: ApiClient,
  id: string,
  input: UpdateBudgetInput,
): Promise<Budget> {
  return client.request<Budget>(`/budgets/${id}`, { method: "PATCH", body: input });
}

export function deleteBudget(client: ApiClient, id: string): Promise<void> {
  return client.request<void>(`/budgets/${id}`, { method: "DELETE" });
}
