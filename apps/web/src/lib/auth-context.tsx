"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthenticatedUser } from "@budget-terry/types";
import type { LoginInput, RegisterInput } from "@budget-terry/validation";
import { apiClient } from "./api-client";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  requestLoginCode: (email: string) => Promise<void>;
  loginWithCode: (email: string, code: string, rememberDevice?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    apiClient
      .restoreSession()
      // A device with no live session falls back to a remembered device
      // trust, if any — restoreSession() already covers the common case
      // (a device that's simply still logged in), this only matters after
      // an explicit logout or an expired refresh token.
      .then((restoredUser) => restoredUser ?? apiClient.tryDeviceLogin())
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  // Centralized here rather than duplicated into every protected page: a
  // signed-in user who hasn't finished the one-time onboarding flow gets
  // sent there first, regardless of which page they land on.
  useEffect(() => {
    if (!isLoading && user && !user.onboardingCompletedAt && pathname !== "/onboarding") {
      router.push("/onboarding");
    }
  }, [isLoading, user, pathname, router]);

  const login = async (input: LoginInput): Promise<void> => {
    setUser(await apiClient.login(input));
  };

  const register = async (input: RegisterInput): Promise<void> => {
    setUser(await apiClient.register(input));
  };

  const requestLoginCode = async (email: string): Promise<void> => {
    await apiClient.requestLoginCode(email);
  };

  const loginWithCode = async (
    email: string,
    code: string,
    rememberDevice?: boolean,
  ): Promise<void> => {
    setUser(await apiClient.verifyLoginCode(email, code, rememberDevice));
  };

  const logout = async (): Promise<void> => {
    await apiClient.logout();
    setUser(null);
  };

  const completeOnboarding = async (): Promise<void> => {
    setUser(await apiClient.completeOnboarding());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        requestLoginCode,
        loginWithCode,
        logout,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
