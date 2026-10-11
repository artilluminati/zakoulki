"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск мест по вводу */

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { searchGeoPlaces } from "@/lib/v5";
import type { GeoPlaceV5 } from "@/types/v5";
import type { SuggestCtlRef } from "./suggest";

/** Выпадающее меню мест для триггера `+`: ввод после + ищет, выбор вставляет +[id:name] */
export default function PlaceSuggest({ query, onPick, onClose, ctlRef }: {
  query: string;
  onPick: (p: GeoPlaceV5) => void;
  onClose: () => void;
  ctlRef: SuggestCtlRef;
}) {
  const [items, setItems] = useState<GeoPlaceV5[]>([]);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(0);
  const hiRef = useRef(0);
  const itemsRef = useRef<GeoPlaceV5[]>([]);

  useEffect(() => {
    if (query.length < 2) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { setItems(await searchGeoPlaces(query)); } catch { setItems([]); }
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
        {loading ? "Ищем места…" : items.length ? `Места: ${items.length}` : "Ничего не нашли — уточните название"}
      </div>
      {items.map((p, i) => (
        <button
          key={`${p.id}-${p.name}-${i}`}
          type="button"
          onMouseEnter={() => pickHi(i)}
          onClick={() => { onPick(p); onClose(); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${i === hi ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
            <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{p.name}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{[p.address, p.district].filter(Boolean).join(" · ")}{p.id === 0 ? " · Яндекс" : ""}</span>
          </span>
        </button>
      ))}
      <button type="button" onClick={onClose} className="block w-full px-3 py-1.5 text-center text-xs text-slate-400 hover:bg-slate-50 dark:text-neutral-500 dark:hover:bg-neutral-800">
        Esc — закрыть
      </button>
    </div>
  );
}
