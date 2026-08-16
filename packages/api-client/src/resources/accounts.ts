import type { Account } from "@budget-terry/types";
import type { CreateAccountInput, UpdateAccountInput } from "@budget-terry/validation";
import type { ApiClient } from "../client";

export function listAccounts(
  client: ApiClient,
  options?: { includeArchived?: boolean },
): Promise<Account[]> {
  const query = options?.includeArchived ? "?includeArchived=true" : "";
  return client.request<Account[]>(`/accounts${query}`);
}

export function getAccount(client: ApiClient, id: string): Promise<Account> {
  return client.request<Account>(`/accounts/${id}`);
}

export function createAccount(client: ApiClient, input: CreateAccountInput): Promise<Account> {
  return client.request<Account>("/accounts", { method: "POST", body: input });
}

export function updateAccount(
  client: ApiClient,
  id: string,
  input: UpdateAccountInput,
): Promise<Account> {
  return client.request<Account>(`/accounts/${id}`, { method: "PATCH", body: input });
}

export function archiveAccount(client: ApiClient, id: string): Promise<Account> {
  return client.request<Account>(`/accounts/${id}/archive`, { method: "POST" });
}

export function restoreAccount(client: ApiClient, id: string): Promise<Account> {
  return client.request<Account>(`/accounts/${id}/restore`, { method: "POST" });
}

export function deleteAccount(client: ApiClient, id: string): Promise<void> {
  return client.request<void>(`/accounts/${id}`, { method: "DELETE" });
}
