"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, X } from "lucide-react";
import MdEditor from "@/components/editor/MdEditor";
import { createThread, createGeoPlace, fetchNearbyThreads, searchGeoPlaces, uploadThreadPhoto } from "@/lib/v5";
import { api } from "@/lib/api";
import type { GeoPlaceV5 } from "@/types/v5";

export default function CreatePage() {
  const router = useRouter();
  const DRAFT_KEY = "zakoulki_draft_v1";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [place, setPlace] = useState<GeoPlaceV5 | null>(null);
  const [pendingGeo, setPendingGeo] = useState<{ latitude: number; longitude: number } | null>(null);

  // черновик: загрузка один раз + автосохранение
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.title) setTitle(d.title);
        if (d.body) setBody(d.body);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [addr, setAddr] = useState("");
  const [found, setFound] = useState<GeoPlaceV5[]>([]);
  const [nearby, setNearby] = useState<{ id: number; body_md: string; place_name?: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [allCats, setAllCats] = useState<{ id: number; name: string }[]>([]);
  const [catIds, setCatIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (addr.length < 3) { setFound([]); return; }
    const t = setTimeout(async () => {
      try { setFound(await searchGeoPlaces(addr)); } catch { setFound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [addr]);

  // автосохранение черновика
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body })); } catch {}
  }, [title, body]);

  useEffect(() => {
    api.get("/categories").then((r) => setAllCats(r.data)).catch(() => {});
  }, []);

  const useGeolocation = () => {
    navigator.geolocation?.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setPendingGeo({ latitude, longitude });
      try { setNearby(await fetchNearbyThreads(latitude, longitude)); } catch {}
    }, () => setError("Геолокация недоступна"));
  };

  const publish = async () => {
    if (!body.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      let placeId = place?.id ?? null;
      if (!placeId && pendingGeo) {
        const p = await createGeoPlace({ name: "Точка на карте", latitude: pendingGeo.latitude, longitude: pendingGeo.longitude, address: "Моя геолокация" });
        placeId = p.id;
      }
      const t = await createThread({ title: title || null, body_md: body, place_id: placeId, category_ids: catIds });
      for (const f of files.slice(0, 5)) {
        try { await uploadThreadPhoto(t.id, f); } catch {}
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(`/thread/${t.id}`);
    } catch (e: any) { setError(e?.response?.data?.detail ?? "Не опубликовалось"); setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <h1 className="text-xl font-extrabold">Новый вопрос</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={150}
        placeholder="Заголовок (необязательно — для важного)"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-lime-500"
      />

      <MdEditor value={body} onChange={setBody} placeholder="Опишите вопрос… @ — человек, + — место, # — тема" />

      {/* категории */}
      {allCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allCats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatIds(catIds.includes(c.id) ? catIds.filter((x) => x !== c.id) : catIds.length < 3 ? [...catIds, c.id] : catIds)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${catIds.includes(c.id) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* фото */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
          📷 Добавить фото ({files.length}/5)
          <input
            type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
          />
        </label>
        {files.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto">
            {files.map((f, i) => (
              <span key={i} className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs">{f.name.slice(0, 18)}</span>
            ))}
            <button onClick={() => setFiles([])} className="shrink-0 text-xs text-red-500">очистить</button>
          </div>
        )}
      </div>

      {/* точка */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-emerald-600" /> Место</span>
          {place || pendingGeo ? (
            <button onClick={() => { setPlace(null); setPendingGeo(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500"><X className="h-4 w-4" /> убрать</button>
          ) : (
            <button onClick={useGeolocation} className="text-xs font-bold text-emerald-700">Моя геолокация</button>
          )}
        </div>
        {place ? (
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
            <div className="font-bold text-emerald-800">{place.name}</div>
            <div className="text-xs text-emerald-600">{[place.address, place.district].filter(Boolean).join(" · ")}</div>
          </div>
        ) : pendingGeo ? (
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
            <div className="font-bold text-emerald-800">Точка на карте</div>
            <div className="text-xs text-emerald-600">Ваша геолокация · прикрепится при публикации</div>
          </div>
        ) : (
          <>
            <input
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="Найти адрес или организацию…"
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white"
            />
            {found.map((p) => (
              <button key={p.id} onClick={() => { setPlace(p); fetchNearbyThreads(p.lat, p.lng).then(setNearby).catch(() => {}); }} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span><span className="block text-sm font-bold">{p.name}</span><span className="block text-xs text-slate-500">{p.address}</span></span>
              </button>
            ))}
          </>
        )}
        {nearby.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
            <div className="text-xs font-bold text-amber-800">Рядом уже обсуждают ({nearby.length}) — гляньте, чтобы не дублировать:</div>
            {nearby.map((n) => (
              <a key={n.id} href={`/thread/${n.id}`} className="mt-1 block truncate text-[13px] text-amber-900 underline">
                #{n.id} {n.body_md.slice(0, 80)} {n.place_name ? `· ${n.place_name}` : ""}
              </a>
            ))}
          </div>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <div className="sticky bottom-20 flex gap-2 md:bottom-6">
        <button onClick={publish} disabled={!body.trim() || saving} className="flex-1 rounded-2xl bg-lime-400 py-3 text-[15px] font-extrabold text-slate-900 disabled:opacity-40 hover:bg-lime-300">
          {saving ? "Публикуем…" : "Опубликовать"}
        </button>
      </div>
      <p className="pb-24 text-center text-xs text-slate-400 md:pb-8">Черновик никуда не сохраняется кроме этой страницы (localStorage — следующим шагом).</p>
    </div>
  );
}
