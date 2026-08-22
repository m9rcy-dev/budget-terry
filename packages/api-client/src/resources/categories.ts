import type { Category } from "@budget-terry/types";
import type { CreateCategoryInput, UpdateCategoryInput } from "@budget-terry/validation";
import type { ApiClient } from "../client";

export function listCategories(
  client: ApiClient,
  options?: { includeArchived?: boolean },
): Promise<Category[]> {
  const query = options?.includeArchived ? "?includeArchived=true" : "";
  return client.request<Category[]>(`/categories${query}`);
}

export function getCategory(client: ApiClient, id: string): Promise<Category> {
  return client.request<Category>(`/categories/${id}`);
}

export function createCategory(client: ApiClient, input: CreateCategoryInput): Promise<Category> {
  return client.request<Category>("/categories", { method: "POST", body: input });
}

export function updateCategory(
  client: ApiClient,
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  return client.request<Category>(`/categories/${id}`, { method: "PATCH", body: input });
}

export function archiveCategory(client: ApiClient, id: string): Promise<Category> {
  return client.request<Category>(`/categories/${id}/archive`, { method: "POST" });
}

export function restoreCategory(client: ApiClient, id: string): Promise<Category> {
  return client.request<Category>(`/categories/${id}/restore`, { method: "POST" });
}

export function deleteCategory(client: ApiClient, id: string): Promise<void> {
  return client.request<void>(`/categories/${id}`, { method: "DELETE" });
}
