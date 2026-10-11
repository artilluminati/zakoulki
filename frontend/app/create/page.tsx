"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты ниже синхронизируют состояние с сервером/localStorage */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, X, ImagePlus } from "lucide-react";
import MdEditor from "@/components/editor/MdEditor";
import TagPicker from "@/components/TagPicker";
import MiniMap from "@/components/MiniMap";
import PasteButton from "@/components/PasteButton";
import PollBuilder, { type PollDraft } from "@/components/PollBuilder";
import { createThread, createGeoPlace, fetchNearbyThreads, searchGeoPlaces, uploadThreadPhoto, reverseGeocode, fetchSimilarPlaces } from "@/lib/v5";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { useScope, scopeLabel } from "@/lib/scope";
import ScopePicker from "@/components/ScopePicker";
import Link from "next/link";
import type { GeoPlaceV5 } from "@/types/v5";

function cleanSnippet(raw: string): string {
  return raw
    .replace(/@\[(\d+):([^\]]+)\]/g, "@$2")
    .replace(/\+\[(\d+):([^\]]+)\]/g, "$2")
    .replace(/\*\*|__|\*|`|#{1,6}\s|> /g, "")
    .slice(0, 80);
}

export default function CreatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const { scope, setScope } = useScope();
  const DRAFT_KEY = "zakoulki_draft_v1";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [place, setPlace] = useState<GeoPlaceV5 | null>(null);
  const [pendingGeo, setPendingGeo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingLabel, setPendingLabel] = useState<{ name: string; address?: string | null } | null>(null);
  const [pendingAddrEdit, setPendingAddrEdit] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  // территория: вершины полигона (центр считается автоматически)
  const [areaMode, setAreaMode] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>([]);

  const centroid = (vs: [number, number][]) =>
    vs.length
      ? { latitude: vs.reduce((s, v) => s + v[0], 0) / vs.length, longitude: vs.reduce((s, v) => s + v[1], 0) / vs.length }
      : null;

  const onMapVertex = (latitude: number, longitude: number, index?: number) => {
    if (!areaMode) return;
    if (index !== undefined) {
      // перетаскивание вершины — обновляем существующую по индексу
      setVertices((prev) => prev.map((v, i) => (i === index ? [latitude, longitude] as [number, number] : v)));
    } else if (vertices.length < 30) {
      // клик по карте — добавляем новую вершину
      setVertices((prev) => [...prev, [latitude, longitude] as [number, number]]);
    }
  };

  // вид карты (центр держится при переключении режимов)
  const [view, setView] = useState({ lat: 55.755, lng: 37.617, nonce: 0 });
  const goView = (latitude: number, longitude: number, zoom?: number) =>
    setView((v) => ({ lat: latitude, lng: longitude, nonce: v.nonce + 1, ...(zoom ? { zoom } : {}) }));

  // автопереход карты на глобально выбранный регион (один раз, пока точку не выбрали)
  const scopeJumped = useRef(false);
  useEffect(() => {
    if (scopeJumped.current) return;
    if (place || pendingGeo || vertices.length > 0) { scopeJumped.current = true; return; }
    if (params.get("lat") && params.get("lng")) { scopeJumped.current = true; return; }
    const label = scope.district || scope.city || scope.region;
    if (!label) { scopeJumped.current = true; return; }
    scopeJumped.current = true;
    const zoom = scope.district ? 13 : scope.city ? 12 : 9;
    searchGeoPlaces(label).then((list) => {
      const hit = list[0];
      if (hit) goView(hit.lat, hit.lng, zoom);
    }).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const resolveGeo = async (latitude: number, longitude: number) => {
    setResolving(true);
    try {
      const r = await reverseGeocode(latitude, longitude);
      setPendingLabel({ name: r.name, address: r.address });
      setPendingAddrEdit(r.address ?? "");
    } catch {
      setPendingLabel({ name: "Точка на карте", address: null });
      setPendingAddrEdit("");
    } finally {
      setResolving(false);
    }
  };

  // точка с карты (?lat=&lng=[&name=][&address=]): сразу видна, без повторного геокодинга
  // (сам эффект ниже, после всех useState — см. перед pickFound)
  const [tags, setTags] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  // черновик: загрузка один раз + автосохранение (точка и теги тоже, фото — нет)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.title) setTitle(d.title);
        if (d.body) setBody(d.body);
        if (Array.isArray(d.tags)) setTags(d.tags.slice(0, 5));
        if (d.place && typeof d.place.id === "number" && d.place.id > 0) setPlace(d.place);
        if (Array.isArray(d.vertices)) {
          const vs = (d.vertices as unknown[]).filter((v): v is [number, number] =>
            Array.isArray(v) && v.length >= 2 && Number.isFinite(+v[0]) && Number.isFinite(+v[1]));
          if (vs.length > 0) setVertices(vs.map((v) => [Number(v[0]), Number(v[1])] as [number, number]).slice(0, 30));
        }
      }
    } catch { /* ignore */ }
  }, []);
  const [addr, setAddr] = useState("");
  const [found, setFound] = useState<GeoPlaceV5[]>([]);
  const [similar, setSimilar] = useState<GeoPlaceV5[]>([]);
  const [nearby, setNearby] = useState<{ id: number; body_md: string; place_name?: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // превью выбранных фото, revoke при изменении/размонтировании
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setThumbs(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // точка с карты (?lat=&lng=[&name=][&address=]): сразу видна, без повторного геокодинга
  useEffect(() => {
    const la = params.get("lat");
    const ln = params.get("lng");
    if (!la || !ln) return;
    const latitude = Number(la);
    const longitude = Number(ln);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    setPendingGeo({ latitude, longitude });
    goView(latitude, longitude);
    const name = params.get("name");
    if (name) {
      setPendingLabel({ name, address: params.get("address") });
    } else {
      resolveGeo(latitude, longitude);
    }
    fetchNearbyThreads(latitude, longitude).then(setNearby).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // выбор места из поиска: результат геокодера (id 0) сначала закрепляем в своей базе
  const pickFound = async (p: GeoPlaceV5) => {
    if (picking) return;
    setPicking(true);
    setError(null);
    try {
      const picked = p.id === 0
        ? await createGeoPlace({ name: p.name, latitude: p.lat, longitude: p.lng, address: p.address, district: p.district, street: p.street, city: p.city || scope.city || null, region: p.region || scope.region || null, country: p.country || scope.country || "Россия" })
        : p;
      setPlace(picked);
      setAdjust(null);
      goView(picked.lat, picked.lng);
      fetchNearbyThreads(picked.lat, picked.lng).then(setNearby).catch(() => { /* ignore */ });
    } catch {
      setError("Не получилось прикрепить место");
    } finally {
      setPicking(false);
    }
  };

  useEffect(() => {
    if (addr.length < 3) { setFound([]); return; }
    const t = setTimeout(async () => {
      try { setFound(await searchGeoPlaces(addr)); } catch { setFound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [addr]);

  // похожие места против дублей: есть координаты новой точки + название
  useEffect(() => {
    const name = pendingLabel?.name || (addr.trim().length >= 3 ? addr.trim() : "");
    if (!pendingGeo || name.length < 3) { setSimilar([]); return; }
    const t = setTimeout(async () => {
      try {
        const list = await fetchSimilarPlaces(name, pendingGeo.latitude, pendingGeo.longitude);
        setSimilar(list.filter((p) => p.id !== place?.id).slice(0, 3));
      } catch { setSimilar([]); }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGeo, pendingLabel, addr, place]);

  // автосохранение черновика
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, tags, place, vertices })); } catch { /* ignore */ }
  }, [title, body, tags, place, vertices]);

  const [geoLocating, setGeoLocating] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  // уточнение выбранного из поиска места перетаскиванием (имя сохраняется)
  const [adjust, setAdjust] = useState<{ latitude: number; longitude: number } | null>(null);

  const useGeolocation = async () => {
    setError(null);
    setGeoLocating(true);
    try {
      if (!("geolocation" in navigator)) throw new Error("unsupported");
      const withPerms = navigator as Navigator & { permissions?: { query(o: { name: string }): Promise<{ state: string }> } };
      if (withPerms.permissions?.query) {
        const st = await withPerms.permissions.query({ name: "geolocation" });
        if (st.state === "denied") throw new Error("denied");
      }
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      const { latitude, longitude } = pos.coords;
      setPendingGeo({ latitude, longitude });
      goView(latitude, longitude);
      resolveGeo(latitude, longitude);
      try { setNearby(await fetchNearbyThreads(latitude, longitude)); } catch { /* ignore */ }
    } catch {
      setError("Не можем определить местоположение — разрешите доступ в браузере");
    } finally {
      setGeoLocating(false);
    }
  };

  const onPinMove = (latitude: number, longitude: number) => {
    if (place && !pendingGeo) {
      // уточнение выбранного места: имя сохраняется, координаты свои
      setAdjust({ latitude, longitude });
      fetchNearbyThreads(latitude, longitude).then(setNearby).catch(() => { /* ignore */ });
      return;
    }
    setPendingGeo({ latitude, longitude });
    resolveGeo(latitude, longitude);
    fetchNearbyThreads(latitude, longitude).then(setNearby).catch(() => { /* ignore */ });
  };

  const publish = async () => {
    if ((!body.trim() && files.length === 0) || saving) return;
    setSaving(true); setError(null);
    try {
      let placeId = place && place.id > 0 && !adjust ? place.id : null;
      if (!placeId && vertices.length >= 3) {
        const c = centroid(vertices)!;
        const r = await reverseGeocode(c.latitude, c.longitude).catch(() => null);
        const p = await createGeoPlace({
          name: r?.name || "Территория",
          latitude: c.latitude, longitude: c.longitude,
          address: r?.address || null, district: r?.district || null, street: r?.street || null,
          city: r?.city || scope.city || null, region: r?.region || scope.region || null,
          country: r?.country || scope.country || "Россия",
          area: vertices,
        });
        placeId = p.id;
      } else if (!placeId && pendingGeo) {
        const r = await reverseGeocode(pendingGeo.latitude, pendingGeo.longitude).catch(() => null);
        const p = await createGeoPlace({
          name: pendingLabel?.name || "Точка на карте",
          latitude: pendingGeo.latitude, longitude: pendingGeo.longitude,
          address: (pendingAddrEdit?.trim() || pendingLabel?.address) || r?.address || null,
          district: r?.district || null,
          city: r?.city || scope.city || null, region: r?.region || scope.region || null,
          country: r?.country || scope.country || "Россия",
        });
        placeId = p.id;
      } else if (!placeId && place && place.id > 0 && adjust) {
        // точку выбранного места уточнили вручную — своя копия с тем же названием
        const p = await createGeoPlace({
          name: place.name,
          latitude: adjust.latitude, longitude: adjust.longitude,
          address: place.address, district: place.district, street: place.street,
          city: place.city || scope.city || null, region: place.region || scope.region || null,
          country: place.country || scope.country || "Россия",
        });
        placeId = p.id;
      }
      const t = await createThread({
        title: title || null, body_md: body, place_id: placeId, tags,
        city: scope.city ?? null, district: scope.district ?? null,
        region: scope.region ?? null, country: scope.country ?? null,
        poll: poll && poll.question.trim() && poll.options.filter((o) => o.trim()).length >= 2
          ? { question: poll.question.trim(), options: poll.options.map((o) => o.trim()).filter(Boolean), multiple: poll.multiple }
          : null,
      });
      let failedPhotos = 0;
      for (const f of files) {
        try { await uploadThreadPhoto(t.id, f); } catch { failedPhotos += 1; }
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      if (failedPhotos > 0) toast(`Опубликовано, но ${failedPhotos} фото не загрузилось`, "error");
      router.push(`/thread/${t.id}`);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      if (status === 401) {
        toast("Сессия истекла — войдите снова", "error");
        router.push("/login");
        setSaving(false);
        return;
      }
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Не опубликовалось";
      setError(msg); setSaving(false);
    }
  };

  return (
    <div
      className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6"
      onPaste={(e) => {
        const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (imgs.length > 0) {
          e.preventDefault();
          setFiles((prev) => [...prev, ...imgs]);
          toast(`Фото добавлено: ${imgs.length}`, "success");
        }
      }}
    >
      <h1 className="text-xl font-extrabold">Новый вопрос</h1>
      {!authLoading && !user && (
        <Link href="/login" className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          Войдите, чтобы задать вопрос →
        </Link>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={150}
        placeholder="Заголовок (необязательно — для важного)"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-lime-500 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <MdEditor value={body} onChange={setBody} placeholder="Опишите вопрос… @ — человек, + — место, # — тема" />

      <TagPicker value={tags} onChange={setTags} />

      <PollBuilder value={poll} onChange={setPoll} />

      {/* фото */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:text-neutral-400">
            <ImagePlus className="h-5 w-5" /> Выбрать{files.length > 0 ? ` (${files.length})` : ""}
            <input
              type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </label>
          <PasteButton onPaste={(imgs) => { setFiles((prev) => [...prev, ...imgs]); toast(`Фото добавлено: ${imgs.length}`, "success"); }} />
        </div>
        {files.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {thumbs.map((src, i) => (
              <span key={`${files[i]?.name}-${files[i]?.size}-${i}`} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" onClick={() => setLightbox(src)} className="h-24 w-full cursor-zoom-in object-contain" />
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  aria-label="Убрать фото"
                  className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setLightbox(null)}>
          <button aria-label="Закрыть" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white">
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}

      {/* выбор города/региона — можно ввести вручную, даже если там ещё нет постов */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Город или район</div>
        <ScopePicker value={scope} onChange={setScope} />
      </div>

      {/* точка / территория — одна карта, позиция не слетает при переключении */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Место</span>
          <span className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setAreaMode(false)}
              className={`rounded-lg px-2 py-1 font-bold ${!areaMode ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}
            >
              Точка
            </button>
            <button
              type="button"
              onClick={() => { setAreaMode(true); setMapExpanded(true); }}
              className={`rounded-lg px-2 py-1 font-bold ${areaMode ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}
            >
              Территория
            </button>
          </span>
          {(place || pendingGeo || vertices.length > 0) && (
            <button onClick={() => { setPlace(null); setPendingGeo(null); setPendingLabel(null); setVertices([]); setAdjust(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 dark:text-neutral-500"><X className="h-4 w-4" /> убрать</button>
          )}
        </div>
        {areaMode && (
          <div className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
            Кликайте по карте — точки соединятся в территорию. Повторный клик по точке убирает её.
            {vertices.length > 0 ? ` · Точек: ${vertices.length}` : ""}
            {vertices.length > 0 && vertices.length < 3 && (
              <span className="font-bold text-amber-600 dark:text-amber-300"> · нужно минимум 3</span>
            )}
            {vertices.length > 0 && (
              <>
                {" · "}
                <button type="button" onClick={() => setVertices((p) => p.slice(0, -1))} className="font-semibold text-slate-500 hover:text-slate-800 dark:text-neutral-400">
                  отменить последнюю
                </button>
                {" · "}
                <button type="button" onClick={() => setVertices([])} className="font-semibold text-slate-400 hover:text-red-500 dark:text-neutral-500">
                  заново
                </button>
              </>
            )}
          </div>
        )}
        {!areaMode && !place && !pendingGeo && (
          <>
            <div className="mt-2 flex gap-2">
              <input
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                placeholder="Найти адрес или организацию…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button onClick={useGeolocation} disabled={geoLocating} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-bold text-emerald-700 disabled:opacity-50 dark:border-neutral-700 dark:text-emerald-300">
                {geoLocating ? "…" : "Найти меня"}
              </button>
            </div>
            {found.map((p) => (
              <button key={`${p.id}-${p.name}`} disabled={picking} onClick={() => pickFound(p)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-neutral-800">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0"><span className="block truncate text-sm font-bold">{p.name}</span><span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{p.address}</span></span>
              </button>
            ))}
          </>
        )}
        {(place || pendingGeo) && !areaMode && (
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">
              {place ? place.name : resolving ? "Определяем адрес…" : (pendingLabel?.name ?? "Точка на карте")}
            </div>
            {place ? (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">{[place.address, place.district].filter(Boolean).join(" · ")}</div>
            ) : (
              <input
                value={pendingAddrEdit ?? ""}
                onChange={(e) => setPendingAddrEdit(e.target.value)}
                placeholder="Уточните адрес…"
                className="mt-1 h-8 w-full rounded-lg border border-emerald-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-neutral-900"
              />
            )}
            {place && (
              <div className="text-[11px] text-emerald-600/70">
                {adjust ? "Точка уточнена вручную" : "Метку на карте можно перетащить для уточнения"}
              </div>
            )}
            {!place && (
              <div className="mt-0.5 text-[11px] text-emerald-600/70">Метку можно перетащить</div>
            )}
          </div>
        )}
        <div className="mt-2">
          <MiniMap
            center={view}
            pin={pendingGeo
              ? { lat: pendingGeo.latitude, lng: pendingGeo.longitude }
              : adjust
                ? { lat: adjust.latitude, lng: adjust.longitude }
                : place ? { lat: place.lat, lng: place.lng } : null}
            onMove={onPinMove}
            areaMode={areaMode}
            vertices={vertices}
            onVertex={onMapVertex}
            onRemoveVertex={(i) => setVertices((prev) => prev.filter((_, j) => j !== i))}
            expanded={mapExpanded}
            onExpandedChange={setMapExpanded}
          />
        </div>
        {similar.length > 0 && !place && (
          <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5 dark:bg-sky-950">
            <div className="text-xs font-bold text-sky-800">Похожие места уже есть — может, это оно?</div>
            {similar.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={picking}
                onClick={() => pickFound(p)}
                className="mt-1 flex w-full items-center gap-2 rounded-xl bg-white/70 px-2 py-1.5 text-left hover:bg-white disabled:opacity-50 dark:bg-neutral-800/70 dark:hover:bg-neutral-800"
              >
                <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{p.name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{[p.address, p.district].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {nearby.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">Рядом уже обсуждают ({nearby.length}) — гляньте, чтобы не дублировать:</div>
            {nearby.map((n) => (
              <a key={n.id} href={`/thread/${n.id}`} className="mt-1 block truncate text-[13px] text-amber-900 underline">
                #{n.id} {cleanSnippet(n.body_md)} {n.place_name ? `· ${n.place_name}` : ""}
              </a>
            ))}
          </div>
        )}
      </div>

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</div>}

      <div className="sticky bottom-20 flex gap-2 md:bottom-6">
        <button onClick={publish} disabled={(!body.trim() && files.length === 0) || saving} className="flex-1 rounded-2xl bg-lime-400 py-3 text-[15px] font-extrabold text-slate-900 disabled:opacity-40 hover:bg-lime-300">
          {saving ? "Публикуем…" : "Опубликовать"}
        </button>
      </div>
      <p className="pb-24 text-center text-xs text-slate-400 md:pb-8 dark:text-neutral-500">Черновик сохраняется автоматически</p>
    </div>
  );
}
