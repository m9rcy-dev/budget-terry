import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client";

function fakeFetch(responses: { status: number; body: unknown }) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(responses.body), {
        status: responses.status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

describe("ApiClient", () => {
  it("returns the parsed JSON body on success", async () => {
    const fetchImpl = fakeFetch({ status: 200, body: { id: "abc" } });
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    const result = await client.request<{ id: string }>("/transactions/abc");

    expect(result).toEqual({ id: "abc" });
  });

  it("sends the Idempotency-Key header when provided", async () => {
    const fetchImpl = fakeFetch({ status: 201, body: { id: "abc" } });
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    await client.request("/transactions", { method: "POST", idempotencyKey: "key-1" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  });

  it("throws an ApiError with the response's code and message on failure", async () => {
    const fetchImpl = fakeFetch({
      status: 404,
      body: { code: "TRANSACTION_NOT_FOUND", message: "Transaction was not found." },
    });
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    await expect(client.request("/transactions/missing")).rejects.toMatchObject({
      status: 404,
      code: "TRANSACTION_NOT_FOUND",
    } satisfies Partial<ApiError>);
  });
});
