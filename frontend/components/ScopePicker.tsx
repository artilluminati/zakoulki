"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск и чтение сохраненного scope */

import { useEffect, useState } from "react";
import { MapPin, X, Search, House, History } from "lucide-react";
import { api } from "@/lib/api";
import { scopeLabel, getHomeCity, getRecentScopes, pushRecentScope, type Scope } from "@/lib/scope";

interface SuggestItem { name: string; count: number; extra?: string | null; level: "city" | "district" | "region"; }

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
          ...(regions.data ?? []).map((r: { name: string; count: number }) => ({ ...r, level: "region" as const })),
          ...(cities.data ?? []).map((c: { name: string; count: number; extra?: string | null }) => ({ ...c, level: "city" as const })),
          ...(districts.data ?? []).map((d: { name: string; count: number; extra?: string | null }) => ({ ...d, level: "district" as const })),
        ];
        setItems(list.slice(0, 10));
        setHi(0);
      } catch { setItems([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const close = () => { setQ(""); setItems([]); setHi(0); };

  // применение выбора: сразу пишем в недавние
  const apply = (s: Scope) => {
    pushRecentScope(s);
    setTick((t) => t + 1);
    onChange(s);
  };

  // крестик снимает один уровень: район -> город -> область -> всё
  const stepUp = () => {
    if (value.any?.length || value.anyLabel) { apply({}); close(); return; }
    const rest: Scope = { ...value };
    if (value.district) delete rest.district;
    else if (value.city) delete rest.city;
    else if (value.region) delete rest.region;
    else { apply({}); close(); return; }
    apply(rest); close();
  };

  const pick = async (name: string, level: "city" | "district" | "region", hint?: string | null) => {
    setResolving(true);
    try {
      const params: Record<string, string> = { name };
      if (hint && level === "city") params.region = hint;
      if (hint && level === "district") params.city = hint;
      const res = await api.get("/geo-places/resolve", { params });
      const r = res.data;
      if (!r.city && !r.region && !r.district) {
        // такого нет в базе — свободный фильтр: сработает где встретится
        apply({ any: [name], anyLabel: name });
      } else {
        apply({
          ...(r.country ? { country: r.country } : {}),
          ...(r.region ? { region: r.region } : {}),
          ...(r.city ? { city: r.city } : {}),
          ...(level === "district" && r.district ? { district: r.district } : {}),
        });
      }
    } catch { /* ignore */ }
    finally { setResolving(false); }
    close();
  };

  const pickCombo = (city: string, region: string) => {
    apply({ country: "Россия", region, city, any: [city, region], anyLabel: `${city} и ${region}` });
    close();
  };

  const topCityRaw = items.find((i) => i.level === "city");
  const topRegionRaw = items.find((i) => i.level === "region");
  // Москва-город и Москва-область с одним названием — одна строка (иначе дубли).
  // Городу отдаём приоритет, hint тянем из записи с контекстом.
  const cityByName = new Map<string, SuggestItem>();
  for (const c of items.filter((i) => i.level === "city")) {
    const k = c.name.toLowerCase();
    const cur = cityByName.get(k);
    if (!cur || (!cur.extra && c.extra)) cityByName.set(k, c);
    else if (!!cur.extra === !!c.extra && c.count > cur.count) cityByName.set(k, c);
  }
  const cityItems = [...cityByName.values()];
  const cityNames = new Set(cityItems.map((c) => c.name.toLowerCase()));
  const shownRegions = items.filter((i) => i.level === "region" && !cityNames.has(i.name.toLowerCase()));
  const districtItems = items.filter((i) => i.level === "district");
  const topCity = cityItems[0] ?? topCityRaw;
  const topRegion = shownRegions[0] ?? topRegionRaw;
  const showCombo = topCity && topRegion && topCity.name !== topRegion.name;

  // строки меню: комби + обычные (для стрелок и Enter)
  const rows: { key: string; label: string; extra?: string | null; sub: string; run: () => void }[] = [
    ...(showCombo ? [{
      key: `combo-${topCity!.name}`,
      label: `${topCity!.name} и ${topRegion!.name}`,
      sub: "город и область",
      run: () => pickCombo(topCity!.name, topRegion!.name),
    }] : []),
    ...cityItems.map((it) => ({
      key: `city-${it.name}-${it.extra ?? ""}`,
      label: it.name,
      extra: it.extra ?? null,
      sub: "город",
      run: () => pick(it.name, "city", it.extra),
    })),
    ...shownRegions.map((it) => ({
      key: `region-${it.name}`,
      label: it.name,
      extra: null,
      sub: "область",
      run: () => pick(it.name, "region"),
    })),
    ...districtItems.map((it) => ({
      key: `district-${it.name}-${it.extra ?? ""}`,
      label: it.name,
      extra: it.extra ?? null,
      sub: "район",
      run: () => pick(it.name, "district", it.extra),
    })),
  ];

  const hasScope = !!(value.country || value.region || value.city || value.district || value.any?.length || value.anyLabel);

  // быстрые строки, пока ничего не введено: домашний город + недавние.
  // tick обновляет их после каждого выбора (пикер на создании не размонтируется).
  const [tick, setTick] = useState(0);
  const homeCity = typeof window === "undefined" ? null : getHomeCity();
  const recents = typeof window === "undefined" ? [] : getRecentScopes();
  void tick;

  return (
    <div className="space-y-2">
      {hasScope && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 truncate font-bold text-emerald-800 dark:text-emerald-300">{scopeLabel(value)}</span>
          <button
            type="button"
            onClick={stepUp}
            aria-label="Сбросить уровень"
            title="Снять уровень: район → город → всё"
            className="rounded-full p-1 text-emerald-600/60 hover:bg-emerald-100 dark:text-emerald-400/60 dark:hover:bg-emerald-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          // 0 — строка «показать как есть», дальше подсказки
          const total = q.trim().length >= 2 ? rows.length + 1 : 0;
          if (e.key === "ArrowDown" && total > 0) {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, total - 1));
          } else if (e.key === "ArrowUp" && total > 0) {
            e.preventDefault();
            if (hi === 0) close();
            else setHi((h) => h - 1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (total > 0) {
              if (hi === 0) pick(q.trim(), "region");
              else if (rows[hi - 1]) rows[hi - 1].run();
            } else if (q.trim().length >= 2) pick(q.trim(), "region");
          } else if (e.key === "Escape") {
            close();
          }
        }}
        placeholder="Город, район или область…"
        maxLength={100}
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800"
      />
      {resolving && <div className="text-center text-xs text-slate-400 dark:text-neutral-500">Определяем…</div>}
      {q.trim().length < 2 && (homeCity || recents.length > 0) && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-700">
          {homeCity && (
            <button
              type="button"
              onClick={() => pick(homeCity, "city")}
              className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-left dark:border-neutral-800 dark:bg-neutral-800"
            >
              <House className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{homeCity}</span>
              <span className="shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">домашний</span>
            </button>
          )}
          {recents.filter((r) => !homeCity || r.label !== homeCity).map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => { apply(r.scope); close(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800"
            >
              <History className="h-4 w-4 shrink-0 text-slate-300 dark:text-neutral-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.label}</span>
              <span className="shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">недавний</span>
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-700">
          <button
            type="button"
            onMouseEnter={() => setHi(0)}
            onClick={() => pick(q.trim(), "region")}
            className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left dark:border-neutral-800 ${hi === 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-slate-50 dark:bg-neutral-800"}`}
          >
            <Search className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold">Показать «{q.trim().slice(0, 40)}»</span>
            <span className="shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">как есть</span>
          </button>
          {rows.map((r, i) => (
            <button
              key={r.key}
              type="button"
              onMouseEnter={() => setHi(i + 1)}
              onClick={r.run}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i + 1 === hi ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-slate-300 dark:text-neutral-500" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {r.label}
                {r.extra && <span className="font-normal text-slate-400 dark:text-neutral-500"> · {r.extra}</span>}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">{r.sub}</span>
            </button>
          ))}
          <div className="border-t border-slate-100 px-3 py-1.5 text-center text-[11px] text-slate-300 dark:border-neutral-800 dark:text-neutral-500">
            ↓ ↑ выбор · Enter — взять · Esc — закрыть
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5">
        <button
          type="button"
          onClick={() => onChange({})}
          className="rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Вся Россия
        </button>
      </div>
    </div>
  );
}
