import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, type TokenStorage } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A real 204 has no body — .json() on it throws. Don't fake it with one. */
function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

function createMemoryTokenStorage(
  initial: string | null = null,
  initialDeviceTrustToken: string | null = null,
): TokenStorage {
  let refreshToken = initial;
  let deviceTrustToken = initialDeviceTrustToken;
  return {
    getRefreshToken: () => refreshToken,
    setRefreshToken: (token) => {
      refreshToken = token;
    },
    getDeviceTrustToken: () => deviceTrustToken,
    setDeviceTrustToken: (token) => {
      deviceTrustToken = token;
    },
  };
}

describe("ApiClient", () => {
  it("returns the parsed JSON body on success", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { id: "abc" }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    const result = await client.request<{ id: string }>("/transactions/abc");

    expect(result).toEqual({ id: "abc" });
  });

  it("sends the Idempotency-Key header when provided", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(201, { id: "abc" }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    await client.request("/transactions", { method: "POST", idempotencyKey: "key-1" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-1");
  });

  it("throws an ApiError with the response's code and message on failure", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(404, { code: "TRANSACTION_NOT_FOUND", message: "Transaction was not found." }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    await expect(client.request("/transactions/missing")).rejects.toMatchObject({
      status: 404,
      code: "TRANSACTION_NOT_FOUND",
    } satisfies Partial<ApiError>);
  });

  it("attaches the access token as a Bearer header once set", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });
    client.setAccessToken("access-1");

    await client.request("/categories");

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-1");
  });

  it("on a 401, refreshes the access token once and retries the original request", async () => {
    const tokenStorage = createMemoryTokenStorage("refresh-1");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "UNAUTHORIZED", message: "Expired" }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "access-2", refreshToken: "refresh-2" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, [{ id: "cat-1" }])) as unknown as typeof fetch;

    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });
    client.setAccessToken("access-1-expired");

    const result = await client.request<{ id: string }[]>("/categories");

    expect(result).toEqual([{ id: "cat-1" }]);
    expect(await tokenStorage.getRefreshToken()).toBe("refresh-2");

    const calls = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0]?.[0]).toBe("https://api.example.com/categories");
    expect(calls[1]?.[0]).toBe("https://api.example.com/auth/refresh");
    expect(calls[2]?.[0]).toBe("https://api.example.com/categories");
  });

  it("does not attempt to refresh when the 401 comes from an auth endpoint itself", async () => {
    const tokenStorage = createMemoryTokenStorage("refresh-1");
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { code: "UNAUTHORIZED", message: "Bad credentials" }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    await expect(
      client.request("/auth/login", { method: "POST", body: {} }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("register stores the access token in memory and the refresh token via tokenStorage", async () => {
    const tokenStorage = createMemoryTokenStorage();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(201, {
        user: { id: "user-1", email: "a@example.com", displayName: "A" },
        accessToken: "access-1",
        refreshToken: "refresh-1",
      }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    const user = await client.register({
      email: "a@example.com",
      password: "a-long-enough-password",
      displayName: "A",
    });

    expect(user.email).toBe("a@example.com");
    expect(await tokenStorage.getRefreshToken()).toBe("refresh-1");
  });

  it("requestLoginCode posts the email and doesn't touch token state", async () => {
    const fetchImpl = vi.fn(async () => emptyResponse(204)) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    await expect(client.requestLoginCode("a@example.com")).resolves.toBeUndefined();

    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example.com/auth/login-code/request");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@example.com" });
  });

  it("verifyLoginCode stores the access token in memory and the refresh token via tokenStorage", async () => {
    const tokenStorage = createMemoryTokenStorage();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        user: { id: "user-1", email: "a@example.com", displayName: "A" },
        accessToken: "access-1",
        refreshToken: "refresh-1",
      }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    const user = await client.verifyLoginCode("a@example.com", "042817");

    expect(user.email).toBe("a@example.com");
    expect(await tokenStorage.getRefreshToken()).toBe("refresh-1");
  });

  it("verifyLoginCode sends rememberDevice and persists the returned device trust token", async () => {
    const tokenStorage = createMemoryTokenStorage();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        user: { id: "user-1", email: "a@example.com", displayName: "A" },
        accessToken: "access-1",
        refreshToken: "refresh-1",
        deviceTrustToken: "trust-1",
      }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    await client.verifyLoginCode("a@example.com", "042817", true);

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      email: "a@example.com",
      code: "042817",
      rememberDevice: true,
    });
    expect(await tokenStorage.getDeviceTrustToken!()).toBe("trust-1");
  });

  it("a plain login does not clear an existing device trust token", async () => {
    const tokenStorage = createMemoryTokenStorage(null, "existing-trust");
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        user: { id: "user-1", email: "a@example.com", displayName: "A" },
        accessToken: "access-1",
        refreshToken: "refresh-1",
      }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    await client.login({ email: "a@example.com", password: "hunter2000000" });

    expect(await tokenStorage.getDeviceTrustToken!()).toBe("existing-trust");
  });

  it("tryDeviceLogin returns null immediately with no stored device trust token", async () => {
    const tokenStorage = createMemoryTokenStorage();
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    await expect(client.tryDeviceLogin()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("tryDeviceLogin signs in and persists the rotated device trust token", async () => {
    const tokenStorage = createMemoryTokenStorage(null, "trust-1");
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        user: { id: "user-1", email: "a@example.com", displayName: "A" },
        accessToken: "access-1",
        refreshToken: "refresh-1",
        deviceTrustToken: "trust-2",
      }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    const user = await client.tryDeviceLogin();

    expect(user?.email).toBe("a@example.com");
    expect(await tokenStorage.getDeviceTrustToken!()).toBe("trust-2");
  });

  it("tryDeviceLogin clears the stored token and returns null when the server rejects it", async () => {
    const tokenStorage = createMemoryTokenStorage(null, "stale-trust");
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { code: "UNAUTHORIZED", message: "Invalid or expired device trust." }),
    ) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    await expect(client.tryDeviceLogin()).resolves.toBeNull();
    expect(await tokenStorage.getDeviceTrustToken!()).toBeNull();
  });

  it("logout clears the refresh token but leaves a device trust token intact", async () => {
    const tokenStorage = createMemoryTokenStorage("refresh-1", "trust-1");
    const fetchImpl = vi.fn(async () => emptyResponse(204)) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });
    client.setAccessToken("access-1");

    await client.logout();

    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(await tokenStorage.getDeviceTrustToken!()).toBe("trust-1");
  });

  it("logout clears local token state and calls the API best-effort", async () => {
    const tokenStorage = createMemoryTokenStorage("refresh-1");
    const fetchImpl = vi.fn(async () => emptyResponse(204)) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });
    client.setAccessToken("access-1");

    await client.logout();

    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it("request() resolves a real 204 No Content response without trying to parse a body", async () => {
    const fetchImpl = vi.fn(async () => emptyResponse(204)) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl });

    await expect(client.request("/accounts/abc", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("restoreSession returns null immediately when there is no stored refresh token", async () => {
    const tokenStorage = createMemoryTokenStorage(null);
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: "https://api.example.com", fetchImpl, tokenStorage });

    await expect(client.restoreSession()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("binds the default fetch implementation, matching the real Fetch API's `this` requirement", async () => {
    // The real browser Fetch API throws "Illegal invocation" if called with
    // `this` set to anything other than the global object — reproduced here
    // rather than relying on jsdom/node-fetch, neither of which enforce it,
    // which is exactly how this regressed unnoticed by every prior test.
    const fakeNativeFetch = function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(jsonResponse(200, { ok: true }));
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fakeNativeFetch as unknown as typeof fetch;

    try {
      const client = new ApiClient({ baseUrl: "https://api.example.com" });
      const result = await client.request<{ ok: boolean }>("/health");
      expect(result).toEqual({ ok: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
