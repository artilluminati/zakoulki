"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Scope } from "@/lib/scope";

const LEVELS = [
  { key: "country", label: "Страна", placeholder: "Например, Россия" },
  { key: "region", label: "Регион", placeholder: "Область, край…" },
  { key: "city", label: "Город", placeholder: "Город, округ…" },
  { key: "district", label: "Район", placeholder: "Район города…" },
] as const;

/** Каскадный выбор: страна → регион → город → район. Пусто = весь мир. */
export default function ScopePicker({ value, onChange }: {
  value: Scope;
  onChange: (s: Scope) => void;
}) {
  const [draft, setDraft] = useState<Scope>(value);
  const [options, setOptions] = useState<Record<string, { name: string; count: number }[]>>({});

  useEffect(() => { setDraft(value); }, [value]);

  const parentOf = (key: string): string | undefined => {
    if (key === "region") return draft.country;
    if (key === "city") return draft.region || draft.country;
    if (key === "district") return draft.city || draft.region || draft.country;
    return undefined;
  };

  const loadOptions = async (key: string, q: string) => {
    try {
      const params: Record<string, string> = { level: key };
      if (q) params.q = q;
      const parent = parentOf(key);
      if (parent) params.parent = parent;
      const res = await api.get("/geo-places/suggest", { params });
      setOptions((o) => ({ ...o, [key]: res.data ?? [] }));
    } catch { /* ignore */ }
  };

  const set = (key: keyof Scope, v: string) => {
    const next = { ...draft, [key]: v.trim() || undefined } as Scope;
    // смена верхнего уровня сбрасывает нижние
    const order: (keyof Scope)[] = ["country", "region", "city", "district"];
    const idx = order.indexOf(key);
    for (let i = idx + 1; i < order.length; i++) delete next[order[i]];
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {LEVELS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <div className="mb-1 text-xs font-bold text-slate-500">{label}</div>
          <input
            value={draft[key] ?? ""}
            name={key}
            list={`scope-${key}`}
            onChange={(e) => { set(e.target.name as keyof Scope, e.target.value); }}
            onFocus={(e) => loadOptions(key, e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white"
          />
          <datalist id={`scope-${key}`}>
            {(options[key] ?? []).map((o) => (
              <option key={o.name} value={o.name}>{o.count} мест</option>
            ))}
          </datalist>
        </div>
      ))}
      <button
        type="button"
        onClick={() => { setDraft({}); onChange({}); }}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        <Globe2 className="h-4 w-4" /> Весь мир
      </button>
    </div>
  );
}
