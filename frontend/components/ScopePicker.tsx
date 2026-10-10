"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск и чтение сохраненного scope */

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { api } from "@/lib/api";
import { scopeLabel, type Scope } from "@/lib/scope";

interface SuggestItem { name: string; count: number; level: "city" | "district" | "region"; }

/** Одно умное поле: город, район или область. Иерархию подтягивает /resolve. */
export default function ScopePicker({ value, onChange }: {
  value: Scope;
  onChange: (s: Scope) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [resolving, setResolving] = useState(false);
  const [hi, setHi] = useState(0);

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const t = setTimeout(async () => {
      try {
        const [cities, districts, regions] = await Promise.all([
          api.get("/geo-places/suggest", { params: { level: "city", q: q.trim(), limit: 4 } }),
          api.get("/geo-places/suggest", { params: { level: "district", q: q.trim(), limit: 4 } }),
          api.get("/geo-places/suggest", { params: { level: "region", q: q.trim(), limit: 4 } }),
        ]);
        const list: SuggestItem[] = [
          ...(cities.data ?? []).map((c: { name: string; count: number }) => ({ ...c, level: "city" as const })),
          ...(districts.data ?? []).map((d: { name: string; count: number }) => ({ ...d, level: "district" as const })),
          ...(regions.data ?? []).map((r: { name: string; count: number }) => ({ ...r, level: "region" as const })),
        ];
        setItems(list.slice(0, 10));
        setHi(0);
      } catch { setItems([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const close = () => { setQ(""); setItems([]); setHi(0); };

  const pick = async (name: string, level: "city" | "district" | "region") => {
    setResolving(true);
    try {
      const res = await api.get("/geo-places/resolve", { params: { name } });
      const r = res.data;
      onChange({
        ...(r.country ? { country: r.country } : {}),
        ...(r.region ? { region: r.region } : {}),
        ...(r.city ? { city: r.city } : {}),
        ...(level === "district" && r.district ? { district: r.district } : {}),
      });
    } catch { /* ignore */ }
    finally { setResolving(false); }
    close();
  };

  const pickCombo = (city: string, region: string) => {
    onChange({ country: "Россия", region, city, any: [city, region], anyLabel: `${city} и ${region}` });
    close();
  };

  const topCity = items.find((i) => i.level === "city");
  const topRegion = items.find((i) => i.level === "region");
  const showCombo = topCity && topRegion && topCity.name !== topRegion.name;

  // строки меню: комби + обычные (для стрелок и Enter)
  const rows: { key: string; label: string; sub: string; run: () => void }[] = [
    ...(showCombo ? [{
      key: `combo-${topCity!.name}`,
      label: `${topCity!.name} и ${topRegion!.name}`,
      sub: "город и область",
      run: () => pickCombo(topCity!.name, topRegion!.name),
    }] : []),
    ...items.map((it) => ({
      key: `${it.level}-${it.name}`,
      label: it.name,
      sub: it.level === "city" ? "город" : it.level === "district" ? "район" : "область",
      run: () => pick(it.name, it.level),
    })),
  ];

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
          if (e.key === "ArrowDown" && rows.length > 0) {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, rows.length - 1));
          } else if (e.key === "ArrowUp" && rows.length > 0) {
            e.preventDefault();
            if (hi === 0) close();
            else setHi((h) => h - 1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (rows[hi]) rows[hi].run();
            else if (q.trim().length >= 2) pick(q.trim(), "city");
          } else if (e.key === "Escape") {
            close();
          }
        }}
        placeholder="Город, район или область…"
        maxLength={100}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white"
      />
      {resolving && <div className="text-center text-xs text-slate-400">Определяем…</div>}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {rows.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onMouseEnter={() => setHi(i)}
              onClick={r.run}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === hi ? "bg-emerald-50" : ""}`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-slate-300" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.label}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{r.sub}</span>
            </button>
          ))}
          <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[11px] text-slate-300">
            ↓ ↑ выбор · Enter — взять · Esc — закрыть
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ country: "Россия" })}
          className="rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Вся Россия
        </button>
      </div>
    </div>
  );
}
