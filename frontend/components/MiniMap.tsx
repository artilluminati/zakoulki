"use client";

import { useEffect, useRef } from "react";
import { loadYandex } from "@/lib/yandex";
import { makePin, PIN_SIZE, PIN_OFFSET } from "@/lib/mapIcons";

/** Мини-карта с перетаскиваемой меткой для экрана создания. */
export default function MiniMap({ lat, lng, onMove }: {
  lat: number; lng: number;
  onMove: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markRef = useRef<any>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
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

  return <div ref={ref} className="h-44 w-full overflow-hidden rounded-xl bg-slate-100" />;
}
