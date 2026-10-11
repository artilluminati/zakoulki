"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск пользователей по вводу */
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SuggestCtlRef } from "./suggest";

export interface UserSuggestItem { id: number; username: string; }

/** Выпадающее меню для `@`: поиск пользователей, вставка @username */
export default function UserSuggest({ query, onPick, onClose, ctlRef }: {
  query: string;
  onPick: (u: UserSuggestItem) => void;
  onClose: () => void;
  ctlRef: SuggestCtlRef;
}) {
  const [items, setItems] = useState<UserSuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(0);
  const hiRef = useRef(0);
  const itemsRef = useRef<UserSuggestItem[]>([]);

  useEffect(() => {
    if (query.length < 2) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get<UserSuggestItem[]>("/users/search", { params: { q: query } });
        setItems(res.data ?? []);
      } catch { setItems([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { hiRef.current = 0; setHi(0); }, [query]);

  useEffect(() => {
    ctlRef.current = {
      move(d) {
        const n = itemsRef.current.length;
        if (!n) return;
        const next = Math.min(Math.max(hiRef.current + d, 0), n - 1);
        hiRef.current = next;
        setHi(next);
      },
      peek: () => hiRef.current,
      count: () => itemsRef.current.length,
      enter: () => {
        const it = itemsRef.current[hiRef.current];
        if (!it) return false;
        onPick(it);
        onClose();
        return true;
      },
    };
    return () => { ctlRef.current = null; };
  }, [ctlRef, onPick, onClose]);

  const pickHi = (i: number) => { hiRef.current = i; setHi(i); };

  if (query.length < 2) return null;

  return (
    <div className="absolute z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
      <div className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
        {loading ? "Ищем людей…" : items.length ? `Люди: ${items.length}` : "Никого не нашли"}
      </div>
      {items.map((u, i) => (
        <button
          key={u.id}
          type="button"
          onMouseEnter={() => pickHi(i)}
          onClick={() => { onPick(u); onClose(); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${i === hi ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-200 text-xs font-extrabold text-slate-900">
            {u.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">@{u.username}</span>
          </span>
        </button>
      ))}
      <button type="button" onClick={onClose} className="block w-full px-3 py-1.5 text-center text-xs text-slate-400 hover:bg-slate-50 dark:text-neutral-500 dark:hover:bg-neutral-800">
        Esc — закрыть
      </button>
    </div>
  );
}
