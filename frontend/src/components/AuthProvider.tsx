"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  reload: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 服务端提示登录已失效时调用。 */
  expire: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const apply = useCallback((next: User) => {
    setUser(next);
    setStatus("authenticated");
  }, []);

  const expire = useCallback(() => {
    setUser(null);
    setStatus("anonymous");
  }, []);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      apply(await api.me());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        expire();
      } else {
        setUser(null);
        setStatus("unavailable");
      }
    }
  }, [apply, expire]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      reload,
      expire,
      login: async (email, password) => apply(await api.login(email, password)),
      register: async (email, password) => apply(await api.register(email, password)),
      logout: async () => {
        await api.logout();
        expire();
      },
    }),
    [status, user, reload, expire, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
