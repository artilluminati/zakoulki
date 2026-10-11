"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any -- синхронизация с сервером и нетипизированный JS API Яндекс.Карт */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Plus, X, MessageCircle, Navigation, ChevronUp } from "lucide-react";
import { fetchMapPoints, fetchThread, reverseGeocode, searchGeoPlaces, scopeParams } from "@/lib/v5";
import { loadYandex } from "@/lib/yandex";
import { api, apiOrigin } from "@/lib/api";
import { makePin, CLUSTER_BLANK, PIN_SIZE, PIN_OFFSET } from "@/lib/mapIcons";
import { useToast } from "@/lib/toast";
import { useScope } from "@/lib/scope";
import type { Scope } from "@/lib/scope";
import PhotoImg from "@/components/PhotoImg";
import type { ThreadV5 } from "@/types/v5";

interface MapPt { id: number; lat: number; lng: number; is_offtop: boolean; is_hub?: boolean; comments: number; has_photo: boolean; cover_url?: string | null; area?: [number, number][] | null; }

const FILTERS = ["Все", "Вопросы", "С фото", "Обсуждают"] as const;
type Filter = (typeof FILTERS)[number];

function passFilter(p: MapPt, f: Filter) {
  if (f === "Вопросы") return !p.is_offtop;
  if (f === "С фото") return p.has_photo;
  return true;
}

// прыжок камеры на глобально выбранный регион (город 12, район 13, область 9)
async function jumpToScope(map: any, s: Scope) {
  const label = s.district || s.city || s.region;
  if (!label || !map) return;
  const list = await searchGeoPlaces(label).catch(() => []);
  const hit = list[0];
  if (!hit) return;
  map.setCenter([hit.lat, hit.lng], s.district ? 13 : s.city ? 12 : 9, { duration: 300 });
}

const MAP_VIEW_KEY = "zakoulki_map_view";

function loadSavedView(): { center: [number, number]; zoom: number } | null {
  try {
    const raw = sessionStorage.getItem(MAP_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Array.isArray(v.center) || !Number.isFinite(v.zoom)) return null;
    return v;
  } catch { return null; }
}

// центр так, чтобы пин оказался выше нижнего шита, а не под ним
function centerAboveSheet(map: any, ll: [number, number]) {
  try {
    map.setCenter(ll);
    const px = map.getGlobalPixelCenter();
    map.setGlobalPixelCenter([px[0], px[1] - 110]);
  } catch { /* ignore */ }
}

export default function MapPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { scope } = useScope();
  const scopeRef = useRef(scope);
  useEffect(() => { scopeRef.current = scope; }, [scope]);
  const focusPlace = params.get("place");
  const ref = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0);
  // точные ссылки на объекты карты: чистка по ref, а не по флагам
  // (флаги через properties ненадёжны — старые кластереры копились и врали счёт)
  const clusterRef = useRef<any>(null);
  const areasRef = useRef<any[]>([]);
  const focusRef = useRef<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("Все");
  const [pts, setPts] = useState<MapPt[]>([]);
  const [selected, setSelected] = useState<ThreadV5 | null>(null);
  const [clusterList, setClusterList] = useState<ThreadV5[] | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  // режим прицела: точка берется из центра экрана, видно адрес до перехода
  const [pickMode, setPickMode] = useState(false);
  const [pickAddr, setPickAddr] = useState<{ name: string; address?: string | null } | null>(null);
  // полигон места из ?place= — рисуем отдельно от кластера
  const [placePoly, setPlacePoly] = useState<{ area: [number, number][]; id: number; threadId?: number } | null>(null);
  // свайп вниз по шиту = закрыть (мобайл)
  const swipeY = useRef<number | null>(null);
  const [sheetDy, setSheetDy] = useState(0);
  const swipeHandlers = (onClose: () => void) => ({
    // eslint-disable-next-line react-hooks/refs -- ref читается только в touch-событиях, не в рендере
    onTouchStart: (e: React.TouchEvent) => { swipeY.current = e.touches[0].clientY; },
    onTouchMove: (e: React.TouchEvent) => {
      if (swipeY.current === null) return;
      const d = e.touches[0].clientY - swipeY.current;
      if (d > 0) setSheetDy(Math.min(d, 160));
    },
    onTouchEnd: () => {
      if (sheetDy > 80) onClose();
      setSheetDy(0);
      swipeY.current = null;
    },
  });
  const sheetStyle = sheetDy > 0 ? { transform: `translateY(${sheetDy}px)` } : undefined;
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
        // возвращаемся туда, где были (назад из треда), иначе дефолт
        const saved = loadSavedView();
        map = new ymaps.Map(ref.current, {
          center: saved?.center ?? [55.755, 37.617], zoom: saved?.zoom ?? 11,
          controls: ["zoomControl", "geolocationControl"],
        });
        (window as any).__ymap = map;
        const paint = async () => {
          const my = ++reqRef.current;
          const b = map.getBounds();
          const s = scopeRef.current;
          let list: MapPt[];
          try {
            list = await fetchMapPoints({
              south: b[0][0], west: b[0][1], north: b[1][0], east: b[1][1],
              ...scopeParams(s),
            });
          } catch {
            return; // сеть моргнула — оставляем старые точки, а не пустую карту
          }
          if (!alive || my !== reqRef.current) return;
          setPts(list);
        };
        await paint();
        if (!alive) return;
        setLoading(false);
        setMapReady(true);
        // стартуем не с Москвы, а с глобально выбранного региона
        // (но если вернулись назад — остаёмся где были)
        if (!focusPlace && !loadSavedView()) jumpToScope(map, scopeRef.current).catch(() => { /* ignore */ });
        const saveView = () => {
          try {
            const c = map.getCenter();
            sessionStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ center: c, zoom: map.getZoom() }));
          } catch { /* ignore */ }
        };
        map.events.add("boundschange", () => { saveView(); paint().catch(() => { /* ignore */ }); });
      } catch { if (alive) { setErr("Карта не загрузилась"); setLoading(false); } }
    })();
    return () => {
      alive = false;
      // сносим наши объекты при размонтировании, чтобы не было висяков
      try {
        if (clusterRef.current) map.geoObjects.remove(clusterRef.current);
      } catch { /* ignore */ }
      clusterRef.current = null;
      for (const o of areasRef.current) {
        try { map.geoObjects.remove(o); } catch { /* ignore */ }
      }
      areasRef.current = [];
      for (const o of focusRef.current) {
        try { map.geoObjects.remove(o); } catch { /* ignore */ }
      }
      focusRef.current = [];
      try { map?.destroy(); } catch { /* ignore */ }
    };
  }, [key, toast]);

  // смена глобального региона на открытой карте — переносим камеру следом
  // (первый запуск пропускаем, если вернулись на сохранённый вид)
  const skipFirstScopeJump = useRef(true);
  useEffect(() => {
    if (!mapReady || focusPlace) return;
    if (skipFirstScopeJump.current) {
      skipFirstScopeJump.current = false;
      if (loadSavedView()) return;
    }
    const map = (window as any).__ymap;
    if (!map) return;
    jumpToScope(map, scope).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, scope]);

  // адрес под прицелом (дебаунс 600мс после остановки карты)
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!mapReady || !map || !pickMode) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = async () => {
      const c = map.getCenter();
      try {
        const r = await reverseGeocode(c[0], c[1]);
        if (alive) setPickAddr({ name: r.name, address: r.address });
      } catch { /* ignore */ }
    };
    update();
    const onMove = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, 600);
    };
    map.events.add("boundschange", onMove);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      try { map.events.remove("boundschange", onMove); } catch { /* ignore */ }
    };
  }, [mapReady, pickMode]);

  // фокус на месте из ?place= — отдельным эффектом, чтобы работал и при смене параметра
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!mapReady || !map) return;
    if (!focusPlace) {
      // ушли с фокуса — гасим полигон, чтобы не висел чужой
      setPlacePoly(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const p = (await api.get(`/geo-places/${focusPlace}`)).data;
        if (!alive) return;
        const ym = (window as any).ymaps;
        if (p.area && p.area.length >= 3) {
          // сохраняем полигон в состояние — эффект перерисовки будет рисовать его
          setPlacePoly({ area: p.area as [number, number][], id: p.id });
          // setBounds ожидает [[south,west],[north,east]]
          const lats = p.area.map((a: number[]) => a[0]);
          const lngs = p.area.map((a: number[]) => a[1]);
          map.setBounds([
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
          ], { checkZoomRange: true, duration: 250 });
        } else {
          setPlacePoly(null);
          map.setCenter([p.lat, p.lng], 15);
        }
        const at = await api.get("/threads", { params: { place_id: p.id, limit: 1 } });
        if (!alive) return;
        if (at.data?.[0]) {
          setSelected(await fetchThread(at.data[0].id));
          if (placePoly) setPlacePoly({ ...placePoly, threadId: at.data[0].id });
        }
      } catch {
        toast("Не получилось открыть место", "error");
      }
    })();
    return () => { alive = false; };
  }, [mapReady, focusPlace, toast]);

  // отрисовка полигона места и точки внутри территории
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!mapReady || !map || !(window as any).ymaps) return;
    const ymaps = (window as any).ymaps;
    // удаляем старые полигоны/точки — только наши, по ref
    for (const o of focusRef.current) {
      try { map.geoObjects.remove(o); } catch { /* ignore */ }
    }
    focusRef.current = [];
    if (!placePoly) return;
    const poly = new ymaps.Polygon([[...placePoly.area, placePoly.area[0]]], {
      isPlacePoly: true,
      threadId: placePoly.id,
    }, {
      fillColor: "#05966966",
      strokeColor: "#059669",
      strokeWidth: 3,
      strokeOpacity: 0.9,
    });
    const threadId = placePoly.threadId ?? placePoly.id;
    poly.events.add("click", async () => {
      try { setSelected(await fetchThread(threadId)); }
      catch { toast("Не получилось открыть вопрос", "error"); }
    });
    map.geoObjects.add(poly);
    focusRef.current.push(poly);
  }, [placePoly, mapReady, toast]);

  // фокус на месте из ?place= — отдельным эффектом, чтобы работал и при смене параметра
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!mapReady || !map) return;
    let alive = true;
    (async () => {
      const b = map.getBounds();
      let list: MapPt[];
      try {
        list = await fetchMapPoints({
          south: b[0][0], west: b[0][1], north: b[1][0], east: b[1][1],
          ...scopeParams(scope),
        });
      } catch {
        return; // сеть моргнула — оставляем старые точки
      }
      if (alive) setPts(list);
    })();
    return () => { alive = false; };
  }, [mapReady, scope]);

  // перерисовка меток при смене точек/фильтра/выбора
  useEffect(() => {
    const map = (window as any).__ymap;
    if (!map || !(window as any).ymaps) return;
    const ymaps = (window as any).ymaps;
    // детерминированная чистка: ровно те объекты, что создали мы
    if (clusterRef.current) {
      try { map.geoObjects.remove(clusterRef.current); } catch { /* ignore */ }
      clusterRef.current = null;
    }
    for (const o of areasRef.current) {
      try { map.geoObjects.remove(o); } catch { /* ignore */ }
    }
    areasRef.current = [];
    const visible = (filter === "Обсуждают"
      ? [...pts].sort((a, b) => b.comments - a.comments)
      : pts
    ).filter((p) => passFilter(p, filter));
    setCount(visible.length);
    const zoom = map.getZoom ? map.getZoom() : 11;
    // крупная сетка: мелкие ячейки давали «висящие рядом» пины на границах
    const grid = zoom < 9 ? 512 : zoom < 12 ? 384 : zoom < 14 ? 256 : 192;
    const clusterer = new ymaps.Clusterer({
      groupByCoordinates: false,
      gridSize: grid,
      // кружок рисует HTML-layout (не зависит от загрузки картинки),
      // иконка — прозрачная заглушка того же размера
      clusterIcons: [{ href: CLUSTER_BLANK, size: [64, 64], offset: [-32, -32] }],
      clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
        '<div style="width:64px;height:64px;border-radius:50%;background:#0f172a;border:4px solid #a3e635;box-shadow:0 4px 14px rgba(2,6,23,.35);display:flex;align-items:center;justify-content:center;color:#a3e635;font-weight:800;font-size:18px;font-family:system-ui,sans-serif;">{{ properties.geoObjects.length }}</div>'
      ),
    });
    clusterRef.current = clusterer;
    // тап по кластеру: всегда управляем сами — дефолтный зум Яндекса
    // на совпадающих точках улетает в максимум и списка не даёт
    clusterer.events.add("click", async (e: any) => {
      const target = e.get("target");
      if (!target || typeof target.getGeoObjects !== "function") return;
      e.preventDefault();
      const objs: any[] = target.getGeoObjects();
      const z = map.getZoom();
      const coords: [number, number][] = objs
        .map((o) => { try { return o.geometry?.getCoordinates?.(); } catch { return null; } })
        .filter((c): c is [number, number] => Array.isArray(c));
      const sameSpot = coords.length > 0 && coords.every((c) =>
        Math.abs(c[0] - coords[0][0]) < 1e-6 && Math.abs(c[1] - coords[0][1]) < 1e-6);
      if (!sameSpot) {
        // маленький кластер — разлетаемся зумом, большой — приближаем на 2
        if ((objs.length <= 3 && z < 17) || (z < 15 && objs.length > 5)) {
          const c = target.geometry?.getCoordinates?.();
          if (c) map.setCenter(c, Math.min(17, z + (objs.length <= 3 ? 3 : 2)), { duration: 250 });
          return;
        }
      }
      // иначе (совпадающие точки или крупный зум) — сразу список тредов
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
      const isHub = !!p.is_hub;
      // центр полигона — для пина раздела и клика
      let cx = p.lat;
      let cy = p.lng;
      if (p.area && p.area.length >= 3) {
        cx = p.area.reduce((s, a) => s + a[0], 0) / p.area.length;
        cy = p.area.reduce((s, a) => s + a[1], 0) / p.area.length;
      }
      const href = isHub
        ? makePin({ color: "#065f46", glyph: "hub", selected: isSel })
        : makePin({
          color: p.is_offtop ? "#64748b" : "#059669",
          glyph: p.is_offtop ? "chat" : "q",
          photoUrl: p.has_photo && p.cover_url ? apiOrigin + p.cover_url : null,
          selected: isSel,
        });
      const m = new ymaps.Placemark([cx, cy], { threadId: p.id }, {
        iconLayout: "default#image", iconImageHref: href,
        iconImageSize: PIN_SIZE, iconImageOffset: PIN_OFFSET,
        hideIconOnBalloonOpen: false,
      });
      m.events.add("click", async () => {
        try { setSelected(await fetchThread(p.id)); }
        catch { toast("Не получилось открыть вопрос", "error"); }
        centerAboveSheet(map, [cx, cy]);
      });
      clusterer.add(m);
    }
    map.geoObjects.add(clusterer);

    // полигоны из map-points — отдельно от кластера (тоже в ref для чистки)
    for (const p of visible) {
      if (!p.area || p.area.length < 3) continue;
      const isSel = selected?.id === p.id;
      const poly = new ymaps.Polygon([[...p.area, p.area[0]]], {
        threadId: p.id,
      }, {
        fillColor: isSel ? "#05966988" : "#05966955",
        strokeColor: "#059669",
        strokeWidth: isSel ? 5 : 3,
        strokeOpacity: 0.9,
      });
      poly.events.add("click", async () => {
        try { setSelected(await fetchThread(p.id)); }
        catch { toast("Не получилось открыть вопрос", "error"); }
        const lats = (p.area ?? []).map((a) => a[0]);
        const lngs = (p.area ?? []).map((a) => a[1]);
        if (lats.length > 0) centerAboveSheet(map, [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2]);
      });
      map.geoObjects.add(poly);
      areasRef.current.push(poly);
    }
  }, [pts, filter, selected, toast]);

  return (
    <div className="-mx-3 md:mx-0 md:pt-4">
      <div className="relative h-[calc(100svh-3.5rem-3.75rem)] overflow-hidden md:h-[calc(100svh-3.5rem-2rem)] md:rounded-3xl md:border md:border-slate-200 md:shadow-sm">
        <div ref={ref} className="absolute inset-0 bg-slate-100 dark:bg-neutral-800" />

        {loading && <div className="absolute inset-0 z-10 animate-pulse bg-slate-200/70 dark:bg-neutral-800/70" />}

        {err ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-6 dark:bg-neutral-800">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm dark:border-amber-800 dark:bg-amber-950">
              {err}. Лента работает — <Link href="/" className="font-bold underline">перейти →</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="absolute left-3 right-3 top-3 z-10 md:left-4 md:right-auto md:w-[380px]">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
                <MapPin className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <input
                  placeholder="Адрес, место, вопрос…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/search?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
                  }}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                />
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold shadow-md backdrop-blur transition ${
                      filter === f ? "bg-slate-900 text-white" : "bg-white/95 text-slate-600 dark:bg-neutral-900/95 dark:text-neutral-300"
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

            {!selected && !clusterList && !pickMode && (
              <button
                type="button"
                onClick={() => { setSelected(null); setClusterList(null); setPickAddr(null); setPickMode(true); }}
                className="absolute bottom-24 right-3 z-10 flex items-center gap-1.5 rounded-full bg-lime-400 py-3 pl-4 pr-5 text-[15px] font-extrabold text-slate-900 shadow-xl transition hover:bg-lime-300 active:scale-95 md:bottom-6 md:right-4"
              >
                <Plus className="h-5 w-5" strokeWidth={3} />
                Спросить здесь
              </button>
            )}

            {pickMode && (
              <>
                {/* прицел по центру экрана */}
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <span className="relative flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-lime-400/30" />
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-lime-400 shadow-xl">
                      <MapPin className="h-6 w-6" />
                    </span>
                  </span>
                </div>
                <div className="absolute inset-x-3 bottom-20 z-20 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-[380px] dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="text-[13px] text-slate-400 dark:text-neutral-500">Точка вопроса — двигайте карту</div>
                  <div className="mt-0.5 truncate text-[15px] font-extrabold">
                    {pickAddr?.name ?? "Определяем адрес…"}
                  </div>
                  {pickAddr?.address && (
                    <div className="truncate text-xs text-slate-500 dark:text-neutral-400">{pickAddr.address}</div>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPickMode(false)}
                      className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 dark:border-neutral-700 dark:text-neutral-300"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const map = (window as any).__ymap;
                        const c = map ? map.getCenter() : null;
                        if (!c) return;
                        const q = new URLSearchParams({
                          lat: String(c[0]), lng: String(c[1]),
                          ...(pickAddr?.name ? { name: pickAddr.name } : {}),
                          ...(pickAddr?.address ? { address: pickAddr.address } : {}),
                        });
                        router.push(`/create?${q.toString()}`);
                      }}
                      className="flex-1 rounded-xl bg-lime-400 py-2.5 text-sm font-extrabold text-slate-900 hover:bg-lime-300"
                    >
                      Спросить здесь
                    </button>
                  </div>
                </div>
              </>
            )}

            {clusterList !== null && !selected && (
              <div
                {...swipeHandlers(() => setClusterList(null))}
                style={sheetStyle}
                className="absolute inset-x-3 bottom-20 z-20 max-h-[45%] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-[380px] dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 dark:bg-neutral-700" />
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="text-sm font-extrabold">
                    {clusterLoading ? "Загружаем…" : `Здесь обсуждают · ${clusterList.length}`}
                  </span>
                  <button onClick={() => setClusterList(null)} aria-label="Закрыть" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:text-neutral-500 dark:hover:bg-neutral-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {clusterList.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => { setSelected(ct); setClusterList(null); }}
                    className="flex w-full items-center gap-2.5 border-b border-slate-50 px-3.5 py-2.5 text-left last:border-0 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[13px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {(ct.author_username ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{ct.title || ct.body_md.slice(0, 60)}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                        <span className="truncate">{ct.author_username}</span>
                        <span className="flex shrink-0 items-center gap-0.5"><MessageCircle className="h-3 w-3" />{ct.comments_count}</span>
                        <span className="flex shrink-0 items-center gap-0.5"><ChevronUp className="h-3 w-3" />{ct.score ?? 0}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div
                {...swipeHandlers(() => setSelected(null))}
                style={sheetStyle}
                className="absolute inset-x-3 bottom-20 z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:bottom-6 md:left-4 md:w-[400px] dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 dark:bg-neutral-700" />
                <div className="flex items-start gap-3.5 p-4">
                  {selected.photos?.[0] ? (
                    <PhotoImg src={selected.photos[0].preview_url ?? selected.photos[0].url} onClick={() => {}} className="h-20 w-20 shrink-0 rounded-xl" />
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950">
                      <MapPin className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {selected.title && <div className="truncate text-base font-extrabold">{selected.title}</div>}
                    <div className="truncate text-[13px] text-slate-500 dark:text-neutral-400">@{selected.author_username}</div>
                    <div className="flex items-center gap-3 truncate text-[13px] text-slate-500 dark:text-neutral-400">
                      <span className="truncate">{selected.place?.name ?? "Без точки"}</span>
                      <span className="flex shrink-0 items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{selected.comments_count}</span>
                      <span className="flex shrink-0 items-center gap-1"><ChevronUp className="h-3.5 w-3.5" />{selected.score ?? 0}</span>
                    </div>
                    <div className="mt-1.5 flex gap-2">
                      <Link href={selected.is_hub ? `/hub/${selected.id}` : `/thread/${selected.id}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-bold text-white">
                        Открыть
                      </Link>
                      {selected.place && (
                        <a
                          href={`https://yandex.ru/maps/?rtext=~${selected.place.lat},${selected.place.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-bold text-slate-600 dark:border-neutral-700 dark:text-neutral-300"
                        >
                          <Navigation className="h-3.5 w-3.5" /> Маршрут
                        </a>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} aria-label="Закрыть" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:text-neutral-500 dark:hover:bg-neutral-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <Link href={selected.is_hub ? `/hub/${selected.id}` : `/thread/${selected.id}`} className="flex items-center justify-center gap-1.5 border-t border-slate-100 py-2 text-[13px] font-semibold text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
                  <MessageCircle className="h-4 w-4" /> Читать обсуждение →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
      <p className="hidden px-1 pt-2 text-xs text-slate-400 md:block dark:text-neutral-500">
        Зеленые — вопросы, серые — оффтоп, с фото — круглые. Кластеры цифрами.
      </p>
    </div>
  );
}
