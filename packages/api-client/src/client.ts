import type { AuthResponse, AuthenticatedUser } from "@budget-terry/types";
import type { LoginInput, RegisterInput } from "@budget-terry/validation";

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /**
   * Where the refresh token is persisted. Deliberately pluggable rather
   * than hardcoded — web uses localStorage, mobile uses Expo SecureStore.
   * See ADR-011.
   */
  tokenStorage?: TokenStorage;
}

export interface TokenStorage {
  getRefreshToken(): Promise<string | null> | string | null;
  setRefreshToken(token: string | null): Promise<void> | void;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /**
   * Sent as the Idempotency-Key header on create requests so retried
   * mutations return the original resource instead of duplicating it.
   * See ADR-007.
   */
  idempotencyKey?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly tokenStorage?: TokenStorage;
  /** Never persisted anywhere — cleared on refresh/reload by design. See ADR-011. */
  private accessToken: string | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.tokenStorage = config.tokenStorage;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    const response = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: input,
    });
    await this.applyAuthResponse(response);
    return response.user;
  }

  async login(input: LoginInput): Promise<AuthenticatedUser> {
    const response = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: input,
    });
    await this.applyAuthResponse(response);
    return response.user;
  }

  async logout(): Promise<void> {
    const refreshToken = await this.tokenStorage?.getRefreshToken();
    this.accessToken = null;
    await this.tokenStorage?.setRefreshToken(null);

    if (refreshToken) {
      // Best-effort — local state is already cleared either way, so a
      // failed request here shouldn't block the user from appearing
      // logged out.
      await this.request("/auth/logout", { method: "POST", body: { refreshToken } }).catch(
        () => undefined,
      );
    }
  }

  /**
   * Call once on app startup: if a refresh token survived from a previous
   * session, exchanges it for a fresh access token and returns the current
   * user — otherwise returns null (no active session).
   */
  async restoreSession(): Promise<AuthenticatedUser | null> {
    const refreshed = await this.refreshAccessToken();
    if (!refreshed) {
      return null;
    }
    return this.request<AuthenticatedUser>("/auth/me");
  }

  async request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    // A 401 on anything other than the auth endpoints themselves gets one
    // silent refresh-and-retry — the caller never sees the expired-token
    // error unless the refresh token has also expired/been revoked.
    if (response.status === 401 && !isRetry && !path.startsWith("/auth/")) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.request<T>(path, options, true);
      }
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      throw new ApiError(
        response.status,
        errorBody?.code ?? "UNKNOWN_ERROR",
        errorBody?.message ?? response.statusText,
      );
    }

    // A 204 (or any genuinely empty body) has nothing for .json() to
    // parse — calling it anyway throws. DELETE and logout both return 204.
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async applyAuthResponse(response: AuthResponse): Promise<void> {
    this.accessToken = response.accessToken;
    await this.tokenStorage?.setRefreshToken(response.refreshToken);
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.tokenStorage) {
      return false;
    }

    const refreshToken = await this.tokenStorage.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        await this.tokenStorage.setRefreshToken(null);
        return false;
      }

      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      this.accessToken = data.accessToken;
      await this.tokenStorage.setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }
}
