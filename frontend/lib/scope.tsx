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
const HOME_KEY = "zakoulki_home_city";
const RECENT_KEY = "zakoulki_recent_scopes";
const RECENT_MAX = 4;

export function scopeLabel(s: Scope): string {
  return s.anyLabel ?? s.district ?? s.city ?? s.region ?? s.country ?? "Вся Россия";
}

/** Домашний город: подставляется в подсказки и как стартовый скоуп. */
export function getHomeCity(): string | null {
  try { return localStorage.getItem(HOME_KEY) || null; } catch { return null; }
}

export function setHomeCity(name: string | null) {
  try {
    if (name) localStorage.setItem(HOME_KEY, name);
    else localStorage.removeItem(HOME_KEY);
  } catch { /* ignore */ }
}

export interface RecentScope { scope: Scope; label: string; ts: number; }

/** Недавние выборы региона — показываем, пока ничего не введено. */
export function getRecentScopes(): RecentScope[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as RecentScope[]) : [];
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

export function pushRecentScope(s: Scope) {
  try {
    const label = scopeLabel(s);
    if (!s.city && !s.region && !s.district && !s.anyLabel) return; // «вся Россия» в историю не пишем
    const list = getRecentScopes().filter((r) => r.label !== label);
    list.unshift({ scope: s, label, ts: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch { /* ignore */ }
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
      if (raw) {
        setScopeState(normalizeScope(JSON.parse(raw) as Scope));
      } else {
        // сохранённого нет — стартуем с домашнего города, если задан
        const home = getHomeCity();
        const init = home ? { city: home } : {};
        setScopeState(init as Scope);
        localStorage.setItem(KEY, JSON.stringify(init));
      }
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
