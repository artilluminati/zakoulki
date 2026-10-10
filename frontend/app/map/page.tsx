"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any -- синхронизация с сервером и нетипизированный JS API Яндекс.Карт */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Plus, X, MessageCircle, Heart, Navigation } from "lucide-react";
import { fetchMapPoints, fetchThread } from "@/lib/v5";
import { api, apiOrigin } from "@/lib/api";
import { makePin, CLUSTER_ICON, CLUSTER_SIZE, CLUSTER_OFFSET, PIN_SIZE, PIN_OFFSET } from "@/lib/mapIcons";
import { useToast } from "@/lib/toast";
import type { ThreadV5 } from "@/types/v5";

function loadYandex(key: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("ssr");
  if ((window as any).ymaps) return (window as any).ymaps.ready();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
    s.onload = () => (window as any).ymaps.ready().then(() => resolve((window as any).ymaps)).catch(reject);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

interface MapPt { id: number; lat: number; lng: number; is_offtop: boolean; comments: number; has_photo: boolean; cover_url?: string | null; }

const FILTERS = ["Все", "Вопросы", "С фото", "Обсуждают"] as const;
type Filter = (typeof FILTERS)[number];

function passFilter(p: MapPt, f: Filter) {
  if (f === "Вопросы") return !p.is_offtop;
  if (f === "С фото") return p.has_photo;
  return true;
}

export default function MapPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const focusPlace = params.get("place");
  const ref = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("Все");
  const [pts, setPts] = useState<MapPt[]>([]);
  const [selected, setSelected] = useState<ThreadV5 | null>(null);
  const [clusterList, setClusterList] = useState<ThreadV5[] | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

  // грузим точки при движении карты
  useEffect(() => {
    if (!key) { setErr("Карта временно недоступна"); setLoading(false); return; }
    let map: any;
    let alive = true;
    (window as any).__ymap = undefined;
    (async () => {
      try {
        const ymaps = await loadYandex(key);
        if (!alive || !ref.current) return;
        map = new ymaps.Map(ref.current, {
          center: [55.755, 37.617], zoom: 11,
          controls: ["zoomControl", "geolocationControl"],
        });
        (window as any).__ymap = map;
        const paint = async () => {
          const my = ++reqRef.current;
          const b = map.getBounds();
          const list = await fetchMapPoints({ south: b[0][0], west: b[0][1], north: b[1][0], east: b[1][1] }).catch(() => [] as MapPt[]);
          if (!alive || my !== reqRef.current) return;
          setPts(list);
        };
        await paint();
        if (!alive) return;
        setLoading(false);
        setMapReady(true);
        map.events.add("boundschange", () => { paint().catch(() => { /* ignore */ }); });
      } catch { if (alive) { setErr("Карта не загрузилась"); setLoading(false); } }
    })();
    return () => { alive = false; try { map?.destroy(); } catch { /* ignore */ } };
  }, [key, toast]);

  // фокус на месте из ?place= — отдельным эффектом, чтобы работал и при смене параметра
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!mapReady || !map || !focusPlace) return;
    let alive = true;
    (async () => {
      try {
        const p = (await api.get(`/geo-places/${focusPlace}`)).data;
        if (!alive) return;
        map.setCenter([p.lat, p.lng], 15);
        const at = await api.get("/threads", { params: { place_id: p.id, limit: 1 } });
        if (!alive) return;
        if (at.data?.[0]) setSelected(await fetchThread(at.data[0].id));
      } catch {
        toast("Не получилось открыть место", "error");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusPlace]);

  // перерисовка меток при смене точек/фильтра/выбора
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!map || !(window as any).ymaps) return;
    const ymaps = (window as any).ymaps;
    map.geoObjects.removeAll();
    const visible = (filter === "Обсуждают"
      ? [...pts].sort((a, b) => b.comments - a.comments)
      : pts
    ).filter((p) => passFilter(p, filter));
    setCount(visible.length);
    const clusterer = new ymaps.Clusterer({
      groupByCoordinates: false,
      clusterIcons: [{ href: CLUSTER_ICON, size: [...CLUSTER_SIZE], offset: [...CLUSTER_OFFSET] }],
      clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
        '<div style="color:#a3e635;font-weight:800;font-size:18px;line-height:64px;width:64px;text-align:center;">{{ properties.geoObjects.length }}</div>'
      ),
    });
    // тап по кластеру на крупном зуме — список тредов, а не бесконечный зум
    clusterer.events.add("click", async (e: any) => {
      const target = e.get("target");
      if (!target || typeof target.getGeoObjects !== "function") return;
      const objs: any[] = target.getGeoObjects();
      if (map.getZoom() < 15 && objs.length > 5) return; // иначе пусть зумит
      e.preventDefault();
      setClusterLoading(true);
      setClusterList([]);
      try {
        // id точки = id треда (см. map-points)
        const ids = objs.map((o) => o.properties?.get?.("threadId")).filter(Boolean);
        const threads = await Promise.all(ids.slice(0, 10).map((id) => fetchThread(id).catch(() => null)));
        setClusterList(threads.filter(Boolean) as ThreadV5[]);
      } finally {
        setClusterLoading(false);
      }
    });
    for (const p of visible) {
      const isSel = selected?.id === p.id;
      const href = makePin({
        color: p.is_offtop ? "#64748b" : "#059669",
        glyph: p.is_offtop ? "chat" : "q",
        photoUrl: p.has_photo && p.cover_url ? apiOrigin + p.cover_url : null,
        selected: isSel,
      });
      const m = new ymaps.Placemark([p.lat, p.lng], { threadId: p.id }, {
        iconLayout: "default#image", iconImageHref: href,
        iconImageSize: PIN_SIZE, iconImageOffset: PIN_OFFSET,
        hideIconOnBalloonOpen: false,
      });
      m.events.add("click", async () => {
        try { setSelected(await fetchThread(p.id)); }
        catch { toast("Не получилось открыть вопрос", "error"); }
      });
      clusterer.add(m);
    }
    map.geoObjects.add(clusterer);
  }, [pts, filter, selected, toast]);

  return (
    <div className="-mx-3 md:mx-0 md:pt-4">
      <div className="relative h-[calc(100svh-3.5rem-3.75rem)] overflow-hidden md:h-[calc(100svh-3.5rem-2rem)] md:rounded-3xl md:border md:border-slate-200 md:shadow-sm">
        <div ref={ref} className="absolute inset-0 bg-slate-100" />

        {loading && <div className="absolute inset-0 z-10 animate-pulse bg-slate-200/70" />}

        {err ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm">
              {err}. Лента работает — <Link href="/" className="font-bold underline">перейти →</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="absolute left-3 right-3 top-3 z-10 md:left-4 md:right-auto md:w-[380px]">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                <MapPin className="h-5 w-5 shrink-0 text-emerald-600" />
                <input
                  placeholder="Адрес, место, вопрос…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/?search=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
                  }}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold shadow-md backdrop-blur transition ${
                      filter === f ? "bg-slate-900 text-white" : "bg-white/95 text-slate-600"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="absolute left-3 top-[112px] z-10 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur md:left-auto md:right-4 md:top-3">
              {count} на экране
            </div>

            {!selected && !clusterList && (
              <Link
                href="/create"
                className="absolute bottom-24 right-3 z-10 flex items-center gap-1.5 rounded-full bg-lime-400 py-3 pl-4 pr-5 text-[15px] font-extrabold text-slate-900 shadow-xl transition hover:bg-lime-300 active:scale-95 md:bottom-6 md:right-4"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
                Спросить здесь
              </Link>
            )}

            {clusterList !== null && !selected && (
              <div className="absolute inset-x-3 bottom-20 z-20 max-h-[45%] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-[380px]">
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5">
                  <span className="text-sm font-extrabold">
                    {clusterLoading ? "Загружаем…" : `Здесь обсуждают · ${clusterList.length}`}
                  </span>
                  <button onClick={() => setClusterList(null)} aria-label="Закрыть" className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {clusterList.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => { setSelected(ct); setClusterList(null); }}
                    className="flex w-full items-center gap-2.5 border-b border-slate-50 px-3.5 py-2.5 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[13px] font-extrabold text-emerald-700">
                      {(ct.author_username ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{ct.title || ct.body_md.slice(0, 60)}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">{ct.author_username}</span>
                        <span className="flex shrink-0 items-center gap-0.5"><MessageCircle className="h-3 w-3" />{ct.comments_count}</span>
                        <span className="flex shrink-0 items-center gap-0.5"><Heart className="h-3 w-3" />{ct.likes_count}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="absolute inset-x-3 bottom-20 z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-[380px]">
                <div className="flex items-start gap-3 p-3.5">
                  {selected.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.photos[0].url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                      <MapPin className="h-6 w-6 text-emerald-600" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {selected.title && <div className="truncate text-[15px] font-extrabold">{selected.title}</div>}
                    <div className="truncate text-[13px] text-slate-500">@{selected.author_username}</div>
                    <div className="flex items-center gap-3 truncate text-[13px] text-slate-500">
                      <span className="truncate">{selected.place?.name ?? "Без точки"}</span>
                      <span className="flex shrink-0 items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{selected.comments_count}</span>
                      <span className="flex shrink-0 items-center gap-1"><Heart className="h-3.5 w-3.5" />{selected.likes_count}</span>
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <Link href={`/thread/${selected.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-bold text-white">
                        Открыть
                      </Link>
                      {selected.place && (
                        <a
                          href={`https://yandex.ru/maps/?rtext=~${selected.place.lat},${selected.place.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-bold text-slate-600"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Маршрут
                        </a>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} aria-label="Закрыть" className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <Link href={`/thread/${selected.id}`} className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2 text-[13px] font-semibold text-slate-500">
                  <MessageCircle className="h-4 w-4" /> Читать обсуждение →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
      <p className="hidden px-1 pt-2 text-xs text-slate-400 md:block">
        Зеленые — вопросы, серые — оффтоп, с фото — круглые. Кластеры цифрами.
      </p>
    </div>
  );
}
