import type { Bill } from "@budget-terry/types";
import type {
  CreateBillInput,
  MarkBillOccurrencePaidInput,
  UpdateBillInput,
} from "@budget-terry/validation";
import type { ApiClient } from "../client";

export function listBills(
  client: ApiClient,
  options?: { includeArchived?: boolean },
): Promise<Bill[]> {
  const query = options?.includeArchived ? "?includeArchived=true" : "";
  return client.request<Bill[]>(`/bills${query}`);
}

export function getBill(client: ApiClient, id: string): Promise<Bill> {
  return client.request<Bill>(`/bills/${id}`);
}

export function createBill(client: ApiClient, input: CreateBillInput): Promise<Bill> {
  return client.request<Bill>("/bills", { method: "POST", body: input });
}

export function updateBill(client: ApiClient, id: string, input: UpdateBillInput): Promise<Bill> {
  return client.request<Bill>(`/bills/${id}`, { method: "PATCH", body: input });
}

export function archiveBill(client: ApiClient, id: string): Promise<Bill> {
  return client.request<Bill>(`/bills/${id}/archive`, { method: "POST" });
}

export function restoreBill(client: ApiClient, id: string): Promise<Bill> {
  return client.request<Bill>(`/bills/${id}/restore`, { method: "POST" });
}

export function payBillOccurrence(
  client: ApiClient,
  billId: string,
  occurrenceId: string,
  input: MarkBillOccurrencePaidInput = {},
): Promise<Bill> {
  return client.request<Bill>(`/bills/${billId}/occurrences/${occurrenceId}/pay`, {
    method: "POST",
    body: input,
  });
}

export function skipBillOccurrence(
  client: ApiClient,
  billId: string,
  occurrenceId: string,
): Promise<Bill> {
  return client.request<Bill>(`/bills/${billId}/occurrences/${occurrenceId}/skip`, {
    method: "POST",
  });
}
