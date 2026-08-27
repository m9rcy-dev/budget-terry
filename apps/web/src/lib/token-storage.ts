import type { TokenStorage } from "@budget-terry/api-client";

const REFRESH_TOKEN_KEY = "budget-terry:refreshToken";
// Separate key from the refresh token — a "remember this device" trust
// deliberately survives logout (see docs/trusted-device-plan.md), while
// the refresh token does not, so they can't share storage.
const DEVICE_TRUST_TOKEN_KEY = "budget-terry:deviceTrustToken";

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
  getDeviceTrustToken: () => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(DEVICE_TRUST_TOKEN_KEY);
  },
  setDeviceTrustToken: (token) => {
    if (typeof window === "undefined") {
      return;
    }
    if (token) {
      window.localStorage.setItem(DEVICE_TRUST_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(DEVICE_TRUST_TOKEN_KEY);
    }
  },
};
