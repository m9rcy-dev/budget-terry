import { ApiClient } from "@budget-terry/api-client";
import { localStorageTokenStorage } from "./token-storage";

export const apiClient = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  tokenStorage: localStorageTokenStorage,
});
