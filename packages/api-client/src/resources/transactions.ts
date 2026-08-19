import type { CategoryTotal, PaginatedResult, Transaction } from "@budget-terry/types";
import type { CreateTransactionInput, UpdateTransactionInput } from "@budget-terry/validation";
import type { ApiClient } from "../client";

export interface ListTransactionsOptions {
  page?: number;
  pageSize?: number;
  accountId?: string;
  categoryId?: string;
  type?: "INCOME" | "EXPENSE";
  from?: string;
  to?: string;
  search?: string;
}

function buildQuery<T extends object>(params: T): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function listTransactions(
  client: ApiClient,
  options: ListTransactionsOptions = {},
): Promise<PaginatedResult<Transaction>> {
  return client.request<PaginatedResult<Transaction>>(`/transactions${buildQuery(options)}`);
}

export function getTransaction(client: ApiClient, id: string): Promise<Transaction> {
  return client.request<Transaction>(`/transactions/${id}`);
}

export function createTransaction(
  client: ApiClient,
  input: CreateTransactionInput,
  idempotencyKey?: string,
): Promise<Transaction> {
  return client.request<Transaction>("/transactions", {
    method: "POST",
    body: input,
    idempotencyKey,
  });
}

export function updateTransaction(
  client: ApiClient,
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  return client.request<Transaction>(`/transactions/${id}`, { method: "PATCH", body: input });
}

export function deleteTransaction(client: ApiClient, id: string): Promise<void> {
  return client.request<void>(`/transactions/${id}`, { method: "DELETE" });
}

export function getCategoryTotals(
  client: ApiClient,
  range: { from: string; to: string },
): Promise<CategoryTotal[]> {
  return client.request<CategoryTotal[]>(`/transactions/category-totals${buildQuery(range)}`);
}
