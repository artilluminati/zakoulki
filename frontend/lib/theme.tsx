"use client";
/* eslint-disable react-hooks/set-state-in-effect -- инициализация темы из localStorage/системы */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const KEY = "zakoulki_theme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s === "dark" || s === "light") setThemeState(s);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setThemeState("dark");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 ${className}`}
    >
      {theme === "dark" ? <Sun className="h-5 w-5 text-amber-300" /> : <Moon className="h-5 w-5 text-slate-600" />}
    </button>
  );
}
