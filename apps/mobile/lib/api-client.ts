import { ApiClient } from "@budget-terry/api-client";
import { secureTokenStorage } from "./token-storage";

export const apiClient = new ApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
  tokenStorage: secureTokenStorage,
});
