"use client";

import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { fetchTags } from "@/lib/v5";

/** Выбор тегов: поиск + популярные + свои. Макс 5. Без # — отдельная сущность. */
export default function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const [suggest, setSuggest] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try { setSuggest(await fetchTags(q || undefined)); } catch { setSuggest([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = (raw: string) => {
    const name = raw.trim().toLowerCase().replace(/^#+/, "");
    if (!name || value.includes(name) || value.length >= 5) return;
    if (!/^[\p{L}0-9_]{2,50}$/u.test(name)) return;
    onChange([...value, name]);
    setQ("");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-bold">Теги <span className="font-normal text-slate-400">· до 5, помогают найти вопрос</span></div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[13px] font-semibold text-emerald-800">
              {t}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Убрать ${t}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q); } }}
          placeholder="Найти или вписать свой…"
          maxLength={50}
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white"
        />
        <button type="button" onClick={() => add(q)} disabled={!q.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white disabled:opacity-40">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {suggest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggest.filter((s) => !value.includes(s.name)).map((s) => (
            <button
              key={s.name} type="button" onClick={() => add(s.name)}
              className="rounded-md bg-slate-100 px-2 py-1 text-[13px] font-medium text-slate-600 hover:bg-slate-200"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
