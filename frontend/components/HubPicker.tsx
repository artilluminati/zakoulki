"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск разделов и мест */

import { useEffect, useState } from "react";
import { ChevronDown, MapPin, Plus, Search } from "lucide-react";
import { searchHubs, searchGeoPlaces, createGeoPlace, createHub, reverseGeocode, type HubListItem, type PickedHub } from "@/lib/v5";
import type { GeoPlaceV5 } from "@/types/v5";
import { useToast } from "@/lib/toast";
import { useScope } from "@/lib/scope";

/** Карточка выбора раздела: свернута по умолчанию, внутри поиск по всем
 * разделам (масштабируется списком) + создание нового с выбором места. */
export default function HubPicker({ value, onChange }: {
  value: PickedHub | null;
  onChange: (h: PickedHub | null) => void;
}) {
  const toast = useToast();
  const { scope } = useScope();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hubs, setHubs] = useState<HubListItem[]>([]);
  const [loading, setLoading] = useState(false);
  // новый раздел: название + место
  const [title, setTitle] = useState("");
  const [pq, setPq] = useState("");
  const [pfound, setPfound] = useState<GeoPlaceV5[]>([]);
  const [pplace, setPplace] = useState<GeoPlaceV5 | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try { setHubs(await searchHubs(q)); } catch { setHubs([]); }
      finally { setLoading(false); }
    }, q.trim().length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, q]);

  useEffect(() => {
    if (pq.trim().length < 3) { setPfound([]); return; }
    const t = setTimeout(async () => {
      try { setPfound(await searchGeoPlaces(pq.trim())); } catch { setPfound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [pq]);

  const create = async () => {
    if (title.trim().length < 2 || !pplace || busy) return;
    setBusy(true);
    try {
      let pid = pplace.id;
      if (pid <= 0) {
        const r = await reverseGeocode(pplace.lat, pplace.lng).catch(() => null);
        const created = await createGeoPlace({
          name: pplace.name, latitude: pplace.lat, longitude: pplace.lng,
          address: pplace.address || r?.address || null, district: pplace.district || r?.district || null,
          street: pplace.street || r?.street || null,
          city: pplace.city || r?.city || scope.city || null,
          region: pplace.region || r?.region || scope.region || null,
          country: pplace.country || r?.country || scope.country || "Россия",
        });
        pid = created.id;
      }
      const h = await createHub(pid, title.trim());
      onChange({ id: h.id, title: h.title || title.trim(), placeId: pid, placeName: pplace.name });
      setTitle(""); setPq(""); setPfound([]); setPplace(null);
      setOpen(false);
      toast("Раздел создан", "success");
    } catch { toast("Не получилось", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-bold dark:text-neutral-100">Раздел</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500 dark:text-neutral-400">
          {value ? `«${value.title}»` : "без раздела — вопрос в общий список"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {value && !open && (
        <div className="px-3 pb-2.5 text-xs text-slate-500 dark:text-neutral-400">
          Место раздела: <b>{value.placeName}</b> — выбирать место ниже не нужно.{" "}
          <button type="button" onClick={() => onChange(null)} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">
            Убрать
          </button>
        </div>
      )}
      {open && (
        <div className="space-y-2 border-t border-slate-100 px-3 py-2.5 dark:border-neutral-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти раздел…"
              maxLength={100}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {loading && <div className="py-2 text-center text-xs text-slate-400">Ищем…</div>}
            {!loading && hubs.length === 0 && (
              <div className="py-2 text-center text-xs text-slate-400 dark:text-neutral-500">Ничего не нашли</div>
            )}
            {hubs.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  if (h.place) onChange({ id: h.id, title: h.title, placeId: h.place.id, placeName: h.place.name });
                  setOpen(false);
                }}
                disabled={!h.place}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-neutral-800 ${value?.id === h.id ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold dark:text-neutral-100">{h.title}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{h.place?.name ?? "без места"}</span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-400 dark:text-neutral-500">{h.members} вопр.</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800">
            <div className="text-xs font-bold text-slate-600 dark:text-neutral-300">Новый раздел</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название…"
              maxLength={150}
              className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            {!pplace ? (
              <>
                <input
                  value={pq}
                  onChange={(e) => setPq(e.target.value)}
                  placeholder="Место раздела: найти…"
                  maxLength={100}
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
                {pfound.length > 0 && (
                  <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                    {pfound.slice(0, 5).map((p) => (
                      <button
                        key={`${p.id}-${p.name}`}
                        type="button"
                        onClick={() => { setPplace(p); setPq(""); setPfound([]); }}
                        className="block w-full truncate px-2 py-1.5 text-left text-[13px] font-semibold hover:bg-slate-50 dark:hover:bg-neutral-800"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[13px] dark:bg-neutral-900">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate font-semibold">{pplace.name}</span>
                <button type="button" onClick={() => setPplace(null)} className="shrink-0 text-xs font-bold text-slate-400 hover:text-red-500">сменить</button>
              </div>
            )}
            <button
              type="button"
              disabled={busy || title.trim().length < 2 || !pplace}
              onClick={create}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[13px] font-bold text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Создать раздел
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
