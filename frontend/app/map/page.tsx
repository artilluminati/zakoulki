"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, Plus, X, MessageCircle, Heart, Navigation } from "lucide-react";
import { fetchMapPoints, fetchThread } from "@/lib/v5";
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

const FILTERS = ["Все", "Вопросы", "С фото", "Обсуждают"] as const;

export default function MapPage() {
  const params = useSearchParams();
  const focusPlace = params.get("place");
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Все");
  const [selected, setSelected] = useState<ThreadV5 | null>(null);
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

  useEffect(() => {
    if (!key) { setErr("Нет ключа Яндекс.Карт"); setLoading(false); return; }
    let map: any;
    let alive = true;
    (async () => {
      try {
        const ymaps = await loadYandex(key);
        if (!alive || !ref.current) return;
        map = new ymaps.Map(ref.current, {
          center: [55.755, 37.617], zoom: 11,
          controls: ["zoomControl", "geolocationControl"],
        });
        mapRef.current = map;
        const load = async () => {
          const b = map.getBounds();
          const pts = await fetchMapPoints({ south: b[0][0], west: b[0][1], north: b[1][0], east: b[1][1] }).catch(() => []);
          return pts as { id: number; lat: number; lng: number; is_offtop: boolean }[];
        };
        const paint = async () => {
          const pts = await load();
          map.geoObjects.removeAll();
          const clusterer = new ymaps.Clusterer({ preset: "islands#invertedVioletClusterIcons", groupByCoordinates: false });
          const marks = pts.map((p) => {
            const m = new ymaps.Placemark(
              [p.lat, p.lng], {},
              { preset: p.is_offtop ? "islands#grayDotIcon" : "islands#greenDotIcon" }
            );
            m.events.add("click", async () => {
              try { setSelected(await fetchThread(p.id)); } catch {}
            });
            return m;
          });
          clusterer.add(marks);
          map.geoObjects.add(clusterer);
          setCount(pts.length);
        };
        await paint();
        if (!alive) return;
        setLoading(false);
        map.events.add("boundschange", () => { paint().catch(() => {}); });
      } catch { if (alive) { setErr("Карта не загрузилась"); setLoading(false); } }
    })();
    return () => { alive = false; try { map?.destroy(); } catch {} mapRef.current = null; };
  }, [key]);

  return (
    <div className="-mx-3 md:mx-0 md:pt-4">
      <div className="relative h-[calc(100svh-3.5rem-3.75rem)] overflow-hidden md:h-[calc(100svh-3.5rem-2rem)] md:rounded-3xl md:border md:border-slate-200 md:shadow-sm">
        <div ref={ref} className="absolute inset-0 bg-slate-100" />

        {loading && (
          <div className="absolute inset-0 z-10 animate-pulse bg-slate-200/70" />
        )}

        {err ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm">
              {err}. Лента работает — <Link href="/" className="font-bold underline">перейти →</Link>
            </div>
          </div>
        ) : (
          <>
            {/* поиск поверх карты */}
            <div className="absolute left-3 right-3 top-3 z-10 md:left-4 md:right-auto md:w-[380px]">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                <MapPin className="h-5 w-5 shrink-0 text-emerald-600" />
                <input
                  placeholder="Адрес, место, вопрос…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") location.href = `/?search=${encodeURIComponent((e.target as HTMLInputElement).value)}`;
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

            {/* счетчик */}
            <div className="absolute right-3 top-3 z-10 rounded-full bg-slate-900/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur md:right-4">
              {count} на экране
            </div>

            {/* FAB */}
            <Link
              href="/create"
              className="absolute bottom-24 right-3 z-10 flex items-center gap-1.5 rounded-full bg-lime-400 py-3 pl-4 pr-5 text-[15px] font-extrabold text-slate-900 shadow-xl transition hover:bg-lime-300 active:scale-95 md:bottom-6 md:right-4"
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
              Спросить здесь
            </Link>

            {/* bottom-sheet превью треда */}
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
                    <div className="truncate text-[13px] text-slate-500">
                      {selected.place?.name ?? "Без точки"} · 💬 {selected.comments_count} · ♥ {selected.likes_count}
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

            {focusPlace && !selected && (
              <div className="absolute bottom-20 left-3 z-10 rounded-full bg-white/95 px-3 py-1.5 text-xs text-slate-500 shadow-lg md:bottom-6 md:left-4">
                Ищем место #{focusPlace}…
              </div>
            )}
          </>
        )}
      </div>
      <p className="hidden px-1 pt-2 text-xs text-slate-400 md:block">
        Кластеры цифрами — приближайте. Тап по точке открывает вопрос.
      </p>
    </div>
  );
}
