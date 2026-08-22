import type { TokenStorage } from "@budget-terry/api-client";

const REFRESH_TOKEN_KEY = "budget-terry:refreshToken";

/**
 * Accepted trade-off for a hobby app given ADR-009's cross-origin hosting —
 * see ADR-011 for the reasoning and what it would take to move this to an
 * HTTP-only cookie later.
 */
export const localStorageTokenStorage: TokenStorage = {
  getRefreshToken: () => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken: (token) => {
    if (typeof window === "undefined") {
      return;
    }
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
};
