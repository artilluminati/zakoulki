"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- JS API Яндекс.Карт без типов */

import { useEffect, useRef, useState } from "react";
import { Maximize2, X, Search } from "lucide-react";
import { loadYandex } from "@/lib/yandex";
import { makePin, makeDot, PIN_SIZE, PIN_OFFSET, DOT_SIZE, DOT_OFFSET } from "@/lib/mapIcons";
import { searchGeoPlaces } from "@/lib/v5";
import type { GeoPlaceV5 } from "@/types/v5";

export interface MapCenter { lat: number; lng: number; nonce: number; }

/** Мини-карта: одна инстанция на оба режима (позиция не слетает).
 * center — явные запросы центрирования (nonce меняется), pin — точка. */
export default function MiniMap({ center, pin, onMove, areaMode = false, vertices = [], onVertex, onRemoveVertex, expanded, onExpandedChange }: {
  center: MapCenter;
  pin: { lat: number; lng: number } | null;
  onMove: (lat: number, lng: number) => void;
  areaMode?: boolean;
  vertices?: [number, number][];
  onVertex?: (lat: number, lng: number, index?: number) => void;
  onRemoveVertex?: (index: number) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const onMoveRef = useRef(onMove);
  const onVertexRef = useRef(onVertex);
  const onRemoveRef = useRef(onRemoveVertex);
  const verticesRef = useRef(vertices);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => { onVertexRef.current = onVertex; }, [onVertex]);
  useEffect(() => { onRemoveRef.current = onRemoveVertex; }, [onRemoveVertex]);
  useEffect(() => { verticesRef.current = vertices; }, [vertices]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<GeoPlaceV5[]>([]);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => { onVertexRef.current = onVertex; }, [onVertex]);
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

  useEffect(() => {
    if (!key) return;
    let alive = true;
    (async () => {
      try {
        const ymaps = await loadYandex(key);
        if (!alive || !ref.current) return;
        const map = new ymaps.Map(ref.current, { center: [center.lat, center.lng], zoom: 16, controls: ["zoomControl"] });
        const mark = new ymaps.Placemark([center.lat, center.lng], {}, {
          iconLayout: "default#image",
          iconImageHref: makePin({ color: "#059669", glyph: "q" }),
          iconImageSize: [...PIN_SIZE], iconImageOffset: [...PIN_OFFSET],
          draggable: true,
          visible: !!pin,
        });
        mark.events.add("dragend", () => {
          const c = mark.geometry.getCoordinates();
          onMoveRef.current(c[0], c[1]);
        });
        map.geoObjects.add(mark);
        map.events.add("click", (e: any) => {
          const c = e.get("coords");
          // повторный клик рядом с вершиной (до 24px) — удалить её
          if (onRemoveRef.current && verticesRef.current.length > 0) {
            try {
              const proj = map.options.get("projection");
              const zoom = map.getZoom();
              const toPage = (ll: number[]) => map.converter.globalToPage(proj.toGlobalPixels(ll, zoom));
              const p = toPage(c);
              let best = -1;
              let bestD = 24;
              verticesRef.current.forEach(([la, ln], i) => {
                const q = toPage([la, ln]);
                const dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
                if (dist < bestD) { bestD = dist; best = i; }
              });
              if (best >= 0) {
                onRemoveRef.current(best);
                return;
              }
            } catch { /* ignore */ }
          }
          if (onVertexRef.current) onVertexRef.current(c[0], c[1]);
        });
        mapRef.current = map;
        markRef.current = mark;
      } catch { /* карта недоступна — адрес текстом выше */ }
    })();
    return () => { alive = false; try { mapRef.current?.destroy(); } catch { /* ignore */ } mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // явное центрирование + позиция пина (в режиме территории главной метки нет)
  useEffect(() => {
    try {
      if (pin && !areaMode) {
        try { markRef.current?.geometry.setCoordinates([pin.lat, pin.lng]); } catch { /* ignore */ }
        try { markRef.current?.options.set("visible", true); } catch { /* ignore */ }
      } else {
        try { markRef.current?.options.set("visible", false); } catch { /* ignore */ }
      }
      mapRef.current?.setCenter([center.lat, center.lng]);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.nonce, areaMode]);

  // перерисовка полигона территории
  useEffect(() => {
    try {
      const map = mapRef.current;
      if (!map || !(window as any).ymaps) return;
      const ymaps = (window as any).ymaps;
      if (polyRef.current) {
        try { map.geoObjects.remove(polyRef.current); } catch { /* ignore */ }
        polyRef.current = null;
      }
      if (vertices.length >= 2) {
        const pts = vertices.map(([la, ln]) => [la, ln]);
        if (pts.length >= 3) pts.push(pts[0]);
        const poly = new ymaps.Polyline(pts, {}, {
          strokeColor: "#059669", strokeWidth: 3, strokeOpacity: 0.9,
        });
        map.geoObjects.add(poly);
        polyRef.current = poly;
      }
      // точки-вершины: перетаскиваемые, dragend обновляет координаты
      const dots = (map as any).__dots as Array<{ remove?: unknown }> | undefined;
      dots?.forEach((d) => { try { map.geoObjects.remove(d); } catch { /* ignore */ } });
      const fresh: any[] = [];
      if (areaMode) {
        vertices.forEach(([la, ln], i) => {
          const d = new ymaps.Placemark([la, ln], { vertexIndex: i }, {
            iconLayout: "default#image",
            iconImageHref: makeDot("#059669", String(i + 1)),
            iconImageSize: [...DOT_SIZE],
            iconImageOffset: [...DOT_OFFSET],
            cursor: "grab",
            draggable: true,
          });
          d.events.add("dragend", () => {
            const c = d.geometry.getCoordinates();
            onVertexRef.current?.(c[0], c[1], i);
          });
          map.geoObjects.add(d);
          fresh.push(d);
        });
      }
      (map as any).__dots = fresh;
    } catch { /* ignore */ }
  }, [vertices, areaMode]);

  // подгоняем карту под размер контейнера при каждом (раз)ворачивании
  useEffect(() => {
    const t = setTimeout(() => {
      try { mapRef.current?.container.fitToViewport(); } catch { /* ignore */ }
    }, 60);
    return () => clearTimeout(t);
  }, [expanded]);

  const toggleExpand = () => {
    onExpandedChange(!expanded);
  };

  const pickSearch = (p: GeoPlaceV5) => {
    setQ("");
    setFound([]);
    onMoveRef.current(p.lat, p.lng);
    try { mapRef.current?.setCenter([p.lat, p.lng], 16); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (q.trim().length < 3) return;
    const t = setTimeout(async () => {
      try { setFound(await searchGeoPlaces(q.trim())); } catch { setFound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div
      className={expanded ? "fixed inset-0 z-[90] bg-slate-900/60 p-3 md:p-6" : "h-44 w-full"}
      onClick={expanded ? toggleExpand : undefined}
    >
      <div
        className={`${expanded
          ? "relative mx-auto h-full max-w-3xl overflow-hidden rounded-2xl"
          : "relative h-full w-full overflow-hidden rounded-xl"}${areaMode ? " minimap-area" : ""}`}
        onClick={expanded ? (e) => e.stopPropagation() : undefined}
      >
        <div ref={ref} className={`ymap-container absolute inset-0 overflow-hidden bg-slate-100 ${areaMode ? "cursor-crosshair" : ""}`} />
        {expanded && (
          <div className="absolute left-2 right-12 top-2 z-10">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-lg">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 3) setFound([]); }}
                placeholder="Найти место…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            {found.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                {found.map((p) => (
                  <button
                    key={`${p.id}-${p.name}`}
                    type="button"
                    onClick={() => pickSearch(p)}
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-bold">{p.name}</span>
                    {p.address && <span className="block truncate text-xs text-slate-500">{p.address}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleExpand(); }}
          aria-label={expanded ? "Свернуть карту" : "Развернуть карту"}
          title={expanded ? "Свернуть карту" : "Развернуть карту"}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/95 p-2 text-slate-600 shadow-md hover:bg-white"
        >
          {expanded ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
