"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск пользователей по вводу */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface UserSuggestItem { id: number; username: string; }

/** Выпадающее меню для `@`: поиск пользователей, вставка @[id:username] */
export default function UserSuggest({ query, onPick, onClose }: {
  query: string;
  onPick: (u: UserSuggestItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<UserSuggestItem[]>([]);
  const [loading, setLoading] = useState(false);

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

  if (query.length < 2) return null;

  return (
    <div className="absolute z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400">
        {loading ? "Ищем людей…" : items.length ? `Люди: ${items.length}` : "Никого не нашли"}
      </div>
      {items.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => { onPick(u); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-emerald-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-200 text-xs font-extrabold text-slate-900">
            {u.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">@{u.username}</span>
          </span>
        </button>
      ))}
      <button type="button" onClick={onClose} className="block w-full px-3 py-1.5 text-center text-xs text-slate-400 hover:bg-slate-50">
        Esc — закрыть
      </button>
    </div>
  );
}
