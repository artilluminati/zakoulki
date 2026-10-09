"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, LocateFixed } from "lucide-react";
import { fetchMapPoints, fetchThreads } from "@/lib/v5";

function loadYandex(key: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("ssr");
  if (window.ymaps) return window.ymaps.ready();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
    s.onload = () => window.ymaps.ready().then(() => resolve(window.ymaps)).catch(reject);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function MapPage() {
  const params = useSearchParams();
  const focusPlace = params.get("place");
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

  useEffect(() => {
    if (!key) { setErr("Нет ключа Яндекс.Карт (.env.local)"); return; }
    let map: any;
    let alive = true;
    (async () => {
      try {
        const ymaps = await loadYandex(key);
        if (!alive || !ref.current) return;
        map = new ymaps.Map(ref.current, { center: [55.755, 37.617], zoom: 11, controls: ["zoomControl", "geolocationControl"] });
        // точки тредов для кластеризации цифрами
        const b = map.getBounds();
        const pts = await fetchMapPoints({ south: b[0][0], west: b[0][1], north: b[1][0], east: b[1][1] }).catch(() => []);
        const clusterer = new ymaps.Clusterer({ preset: "islands#invertedVioletClusterIcons", groupByCoordinates: false });
        const marks = pts.map((p: any) => new ymaps.Placemark([p.lat, p.lng], { balloonContent: `<a href="/thread/${p.id}">Открыть вопрос #${p.id}</a>` }, { preset: p.is_offtop ? "islands#grayDotIcon" : "islands#greenDotIcon" }));
        clusterer.add(marks);
        map.geoObjects.add(clusterer);
        setCount(pts.length);
        map.events.add("boundschange", async () => {
          try {
            const bb = map.getBounds();
            const next = await fetchMapPoints({ south: bb[0][0], west: bb[0][1], north: bb[1][0], east: bb[1][1] });
            clusterer.removeAll();
            clusterer.add(next.map((p: any) => new ymaps.Placemark([p.lat, p.lng], { balloonContent: `<a href="/thread/${p.id}">Открыть вопрос #${p.id}</a>` })));
            setCount(next.length);
          } catch {}
        });
      } catch { setErr("Карта не загрузилась, лента работает"); }
    })();
    return () => { alive = false; try { map?.destroy(); } catch {} };
  }, [key]);

  return (
    <div className="px-3 pt-4 md:px-0 md:pt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 text-[13px]">
          {["Все", "Вопросы", "Проблемы", "Оффтоп"].map((f, i) => (
            <span key={f} className={`rounded-full border px-3 py-1.5 font-semibold ${i === 0 ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>{f}</span>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400">Точек: {count}</span>
        <Link href="/create" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[13px] font-bold text-white">
          <MapPin className="h-4 w-4" /> Спросить здесь
        </Link>
      </div>
      {err ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm">
          {err} <Link href="/" className="font-bold underline">→ в ленту</Link>
        </div>
      ) : (
        <div ref={ref} className="h-[62vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm md:h-[70vh]" />
      )}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <LocateFixed className="h-3.5 w-3.5" /> Кластеры цифрами, тап раскрывает. {focusPlace ? `Фокус на месте #${focusPlace}.` : ""}
      </p>
    </div>
  );
}
