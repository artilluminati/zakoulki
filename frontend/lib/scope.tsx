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

/** «Вся Россия» — это пустой скоуп. Старое представление {country:"Россия"}
 * нормализуем в {}, чтобы не было двух одинаковых состояний. */
export function normalizeScope(s: Scope): Scope {
  const geo = [s.country, s.region, s.city, s.district].filter(Boolean);
  if (geo.length === 1 && geo[0] === "Россия" && !s.any?.length && !s.anyLabel) return {};
  return s;
}

interface ScopeCtx {
  scope: Scope;
  setScope: (s: Scope) => void;
  clearScope: () => void;
}

const Ctx = createContext<ScopeCtx>({ scope: {}, setScope: () => {}, clearScope: () => {} });

export function ScopeProvider({ children }: { children: ReactNode }) {
  // по умолчанию — вся Россия (пустой скоуп = без фильтра)
  const [scope, setScopeState] = useState<Scope>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setScopeState(normalizeScope(JSON.parse(raw) as Scope));
      else localStorage.setItem(KEY, JSON.stringify({}));
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
