"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { searchGeoPlaces } from "@/lib/v5";
import type { GeoPlaceV5 } from "@/types/v5";

/** Выпадающее меню мест для триггера `+`: ввод после + ищет, выбор вставляет +[id:name] */
export default function PlaceSuggest({ query, onPick, onClose }: { query: string; onPick: (p: GeoPlaceV5) => void; onClose: () => void }) {
  const [items, setItems] = useState<GeoPlaceV5[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { setItems(await searchGeoPlaces(query)); } catch { setItems([]); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (query.length < 2) return null;

  return (
    <div className="absolute z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400">
        {loading ? "Ищем места…" : items.length ? `Места: ${items.length}` : "Ничего не нашли — точка создастся при публикации"}
      </div>
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => { onPick(p); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-emerald-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <MapPin className="h-4 w-4 text-emerald-700" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{p.name}</span>
            <span className="block truncate text-xs text-slate-500">{[p.address, p.district].filter(Boolean).join(" · ")}</span>
          </span>
        </button>
      ))}
      <button type="button" onClick={onClose} className="block w-full px-3 py-1.5 text-center text-xs text-slate-400 hover:bg-slate-50">
        Esc — закрыть
      </button>
    </div>
  );
}
