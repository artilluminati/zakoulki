"use client";
/* eslint-disable react-hooks/set-state-in-effect -- чтение сохраненного scope из localStorage */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface Scope {
  country?: string;
  region?: string;
  city?: string;
  district?: string;
  any?: string[];
  anyLabel?: string;
}

const KEY = "zakoulki_scope_v1";

export function scopeLabel(s: Scope): string {
  return s.anyLabel ?? s.district ?? s.city ?? s.region ?? s.country ?? "Вся Россия";
}

interface ScopeCtx {
  scope: Scope;
  setScope: (s: Scope) => void;
  clearScope: () => void;
}

const Ctx = createContext<ScopeCtx>({ scope: {}, setScope: () => {}, clearScope: () => {} });

export function ScopeProvider({ children }: { children: ReactNode }) {
  // по умолчанию — вся Россия (мира пока нет в интерфейсе)
  const [scope, setScopeState] = useState<Scope>({ country: "Россия" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setScopeState(JSON.parse(raw) as Scope);
      else localStorage.setItem(KEY, JSON.stringify({ country: "Россия" }));
    } catch { /* ignore */ }
  }, []);

  const setScope = useCallback((s: Scope) => {
    setScopeState(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, []);

  const clearScope = useCallback(() => setScope({}), [setScope]);

  return <Ctx.Provider value={{ scope, setScope, clearScope }}>{children}</Ctx.Provider>;
}

export function useScope() {
  return useContext(Ctx);
}
