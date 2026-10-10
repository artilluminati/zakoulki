"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск и чтение сохраненного scope */

import { useEffect, useState } from "react";
import { Globe2, MapPin, X } from "lucide-react";
import { api } from "@/lib/api";
import { scopeLabel, type Scope } from "@/lib/scope";

interface SuggestItem { name: string; count: number; level: "city" | "district"; }

/** Одно умное поле: город или район. Иерархию подтягивает /resolve. Без стран — мы про Россию. */
export default function ScopePicker({ value, onChange }: {
  value: Scope;
  onChange: (s: Scope) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const t = setTimeout(async () => {
      try {
        const [cities, districts] = await Promise.all([
          api.get("/geo-places/suggest", { params: { level: "city", q: q.trim(), limit: 5 } }),
          api.get("/geo-places/suggest", { params: { level: "district", q: q.trim(), limit: 5 } }),
        ]);
        const list: SuggestItem[] = [
          ...(cities.data ?? []).map((c: { name: string; count: number }) => ({ ...c, level: "city" as const })),
          ...(districts.data ?? []).map((d: { name: string; count: number }) => ({ ...d, level: "district" as const })),
        ];
        setItems(list.slice(0, 8));
      } catch { setItems([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (name: string) => {
    setResolving(true);
    try {
      const res = await api.get("/geo-places/resolve", { params: { name } });
      const r = res.data;
      onChange({
        ...(r.country ? { country: r.country } : {}),
        ...(r.region ? { region: r.region } : {}),
        ...(r.city ? { city: r.city } : {}),
        ...(r.district ? { district: r.district } : {}),
      });
    } catch { /* ignore */ }
    finally { setResolving(false); }
    setQ("");
    setItems([]);
  };

  const hasScope = !!(value.country || value.region || value.city || value.district);

  return (
    <div className="space-y-2">
      {hasScope && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate font-bold text-emerald-800">{scopeLabel(value)}</span>
          <button
            type="button"
            onClick={() => onChange({})}
            aria-label="Сбросить"
            className="rounded-full p-1 text-emerald-600/60 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (items.length > 0) pick(items[0].name);
            else if (q.trim().length >= 2) pick(q.trim());
          }
        }}
        placeholder="Город или район…"
        maxLength={100}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white"
      />
      {resolving && <div className="text-center text-xs text-slate-400">Определяем…</div>}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {items.map((it) => (
            <button
              key={`${it.level}-${it.name}`}
              type="button"
              onClick={() => pick(it.name)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            >
              <MapPin className="h-4 w-4 shrink-0 text-slate-300" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{it.level === "city" ? "город" : "район"}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ country: "Россия" })}
          className="rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Вся Россия
        </button>
        <button
          type="button"
          onClick={() => onChange({})}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Globe2 className="h-4 w-4" /> Весь мир
        </button>
      </div>
    </div>
  );
}
