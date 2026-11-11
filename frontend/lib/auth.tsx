"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверяем сохранённый токен один раз при загрузке приложения.
  const refreshUser = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      // применяем сохранённую тему из профиля (синхронизация между устройствами)
      if (res.data?.theme) {
        try {
          const t = res.data.theme;
          if (t === "light" || t === "dark") {
            localStorage.setItem("zakoulki_theme", t);
            document.documentElement.classList.toggle("dark", t === "dark");
          } else {
            // system — следуем за ОС
            localStorage.removeItem("zakoulki_theme");
            const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            document.documentElement.classList.toggle("dark", dark);
          }
          window.dispatchEvent(new CustomEvent("zakoulki-theme", { detail: t }));
        } catch { /* ignore */ }
      }
    } catch {
      // токен протух или невалиден
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // первичную проверку сессии держим в эффекте: читаем токен из внешнего хранилища
  /* eslint-disable react-hooks/set-state-in-effect -- синхронизация с localStorage при старте */
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.access_token);
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(
    async (username: string, email: string, password: string, name?: string) => {
      await api.post("/auth/register", { username, email, password, name: name || undefined });
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth должен использоваться внутри <AuthProvider>");
  }
  return ctx;
}
