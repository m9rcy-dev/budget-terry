import * as SecureStore from "expo-secure-store";
import type { TokenStorage } from "@budget-terry/api-client";

const REFRESH_TOKEN_KEY = "budget-terry-refresh-token";

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
};
