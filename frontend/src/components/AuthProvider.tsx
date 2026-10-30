"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "unavailable";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** 同一用户退出后重新登录、被 React 合并更新时，这个版本号也会变化。 */
  identityVersion: number;
  reload: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 查询调用方传入所属身份版本，避免 effect 清理前的旧 401 清除新身份。 */
  expire: (expectedIdentityVersion?: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [identityVersion, setIdentityVersion] = useState(0);
  const identityRevision = useRef(0);
  const generation = useRef(0);
  const pendingMutation = useRef<number | null>(null);
  const settledStatus = useRef<AuthStatus>("unavailable");

  const apply = useCallback((next: User) => {
    settledStatus.current = "authenticated";
    setIdentityVersion(++identityRevision.current);
    setUser(next);
    setStatus("authenticated");
  }, []);

  const expire = useCallback((expectedIdentityVersion?: number) => {
    if (expectedIdentityVersion !== undefined && expectedIdentityVersion !== identityRevision.current) return;
    // 任务查询属于旧凭据，不能影响进行中的登录或退出
    if (expectedIdentityVersion !== undefined && pendingMutation.current === generation.current) return;
    generation.current += 1;
    settledStatus.current = "anonymous";
    setIdentityVersion(++identityRevision.current);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const reload = useCallback(async () => {
    const request = ++generation.current;
    setStatus("loading");
    try {
      const next = await api.me();
      if (request === generation.current) apply(next);
    } catch (error) {
      if (request !== generation.current) return;
      if (error instanceof ApiError && error.status === 401) {
        expire();
      } else {
        settledStatus.current = "unavailable";
        setUser(null);
        setStatus("unavailable");
      }
    }
  }, [apply, expire]);

  useEffect(() => {
    void reload();
    // StrictMode 的清理只让首次 effect 失效，不能把组件永久标记为已卸载
    return () => { generation.current += 1; };
  }, [reload]);

  const authenticate = useCallback(async (method: "login" | "register", email: string, password: string) => {
    const request = ++generation.current;
    pendingMutation.current = request;
    try {
      const next = await api[method](email, password);
      if (request === generation.current) apply(next);
    } catch (error) {
      if (request === generation.current) {
        setStatus(settledStatus.current);
        throw error;
      }
    } finally {
      if (pendingMutation.current === request) pendingMutation.current = null;
    }
  }, [apply]);

  const logout = useCallback(async () => {
    const request = ++generation.current;
    pendingMutation.current = request;
    try {
      await api.logout();
      if (request === generation.current) expire();
    } catch (error) {
      if (request === generation.current) {
        setStatus(settledStatus.current);
        throw error;
      }
    } finally {
      if (pendingMutation.current === request) pendingMutation.current = null;
    }
  }, [expire]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      identityVersion,
      reload,
      expire,
      login: (email, password) => authenticate("login", email, password),
      register: (email, password) => authenticate("register", email, password),
      logout,
    }),
    [status, user, identityVersion, reload, expire, authenticate, logout],
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
