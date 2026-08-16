"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@budget-terry/types";
import type { LoginInput, RegisterInput } from "@budget-terry/validation";
import { apiClient } from "./api-client";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .restoreSession()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (input: LoginInput): Promise<void> => {
    setUser(await apiClient.login(input));
  };

  const register = async (input: RegisterInput): Promise<void> => {
    setUser(await apiClient.register(input));
  };

  const logout = async (): Promise<void> => {
    await apiClient.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
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
