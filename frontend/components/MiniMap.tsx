"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- JS API Яндекс.Карт без типов */

import { useEffect, useRef } from "react";
import { loadYandex } from "@/lib/yandex";
import { makePin, PIN_SIZE, PIN_OFFSET } from "@/lib/mapIcons";

/** Мини-карта: точка (перетаскиваемая метка) или территория (клики = вершины). */
export default function MiniMap({ lat, lng, onMove, areaMode = false, vertices = [], onVertex }: {
  lat: number; lng: number;
  onMove: (lat: number, lng: number) => void;
  areaMode?: boolean;
  vertices?: [number, number][];
  onVertex?: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const onMoveRef = useRef(onMove);
  const onVertexRef = useRef(onVertex);
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
        const map = new ymaps.Map(ref.current, { center: [lat, lng], zoom: 16, controls: ["zoomControl"] });
        const mark = new ymaps.Placemark([lat, lng], {}, {
          iconLayout: "default#image",
          iconImageHref: makePin({ color: "#059669", glyph: "q" }),
          iconImageSize: [...PIN_SIZE], iconImageOffset: [...PIN_OFFSET],
          draggable: true,
        });
        mark.events.add("dragend", () => {
          const c = mark.geometry.getCoordinates();
          onMoveRef.current(c[0], c[1]);
        });
        map.geoObjects.add(mark);
        map.events.add("click", (e: any) => {
          const c = e.get("coords");
          if (onVertexRef.current) onVertexRef.current(c[0], c[1]);
        });
        mapRef.current = map;
        markRef.current = mark;
      } catch { /* карта недоступна — адрес текстом выше */ }
    })();
    return () => { alive = false; try { mapRef.current?.destroy(); } catch { /* ignore */ } mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // двигаем метку вслед за внешними изменениями координат
  useEffect(() => {
    try {
      markRef.current?.geometry.setCoordinates([lat, lng]);
      mapRef.current?.setCenter([lat, lng]);
    } catch { /* ignore */ }
  }, [lat, lng]);

  // перерисовка полигона территории
  useEffect(() => {
    try {
      const map = mapRef.current;
      if (!map || !(window as any).ymaps) return;
      if (polyRef.current) {
        try { map.geoObjects.remove(polyRef.current); } catch { /* ignore */ }
        polyRef.current = null;
      }
      if (vertices.length >= 2) {
        const ymaps = (window as any).ymaps;
        const pts = vertices.map(([la, ln]) => [la, ln]);
        if (pts.length >= 3) pts.push(pts[0]);
        const poly = new ymaps.Polyline(pts, {}, {
          strokeColor: "#059669", strokeWidth: 3, strokeOpacity: 0.9,
        });
        map.geoObjects.add(poly);
        polyRef.current = poly;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dots = (map as any).__dots as any[] | undefined;
      dots?.forEach((d) => { try { map.geoObjects.remove(d); } catch { /* ignore */ } });
      const fresh: any[] = [];
      if (areaMode) {
        const ymaps = (window as any).ymaps;
        for (const [la, ln] of vertices) {
          const d = new ymaps.Placemark([la, ln], {}, { preset: "islands#greenDotIcon" });
          map.geoObjects.add(d);
          fresh.push(d);
        }
      }
      (map as any).__dots = fresh;
    } catch { /* ignore */ }
  }, [vertices, areaMode]);

  return <div ref={ref} className="h-44 w-full overflow-hidden rounded-xl bg-slate-100" />;
}
