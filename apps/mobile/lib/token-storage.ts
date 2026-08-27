import * as SecureStore from "expo-secure-store";
import type { TokenStorage } from "@budget-terry/api-client";

const REFRESH_TOKEN_KEY = "budget-terry-refresh-token";
// Separate key from the refresh token — a "remember this device" trust
// deliberately survives logout (see docs/trusted-device-plan.md), while
// the refresh token does not, so they can't share storage.
const DEVICE_TRUST_TOKEN_KEY = "budget-terry-device-trust-token";

/** OS-level encrypted storage — see ADR-011. */
export const secureTokenStorage: TokenStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: async (token) => {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  },
  getDeviceTrustToken: () => SecureStore.getItemAsync(DEVICE_TRUST_TOKEN_KEY),
  setDeviceTrustToken: async (token) => {
    if (token) {
      await SecureStore.setItemAsync(DEVICE_TRUST_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(DEVICE_TRUST_TOKEN_KEY);
    }
  },
};
