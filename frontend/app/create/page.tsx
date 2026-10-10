"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты ниже синхронизируют состояние с сервером/localStorage */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, X, ImagePlus } from "lucide-react";
import MdEditor from "@/components/editor/MdEditor";
import TagPicker from "@/components/TagPicker";
import MiniMap from "@/components/MiniMap";
import { createThread, createGeoPlace, fetchNearbyThreads, searchGeoPlaces, uploadThreadPhoto, reverseGeocode } from "@/lib/v5";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
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
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const DRAFT_KEY = "zakoulki_draft_v1";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [place, setPlace] = useState<GeoPlaceV5 | null>(null);
  const [pendingGeo, setPendingGeo] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingLabel, setPendingLabel] = useState<{ name: string; address?: string | null } | null>(null);
  const [resolving, setResolving] = useState(false);

  const resolveGeo = async (latitude: number, longitude: number) => {
    setResolving(true);
    try {
      const r = await reverseGeocode(latitude, longitude);
      setPendingLabel({ name: r.name, address: r.address });
    } catch {
      setPendingLabel({ name: "Точка на карте", address: null });
    } finally {
      setResolving(false);
    }
  };
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
      }
    } catch { /* ignore */ }
  }, []);
  const [addr, setAddr] = useState("");
  const [found, setFound] = useState<GeoPlaceV5[]>([]);
  const [nearby, setNearby] = useState<{ id: number; body_md: string; place_name?: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // превью выбранных фото, revoke при изменении/размонтировании
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setThumbs(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // выбор места из поиска: результат геокодера (id 0) сначала закрепляем в своей базе
  const pickFound = async (p: GeoPlaceV5) => {
    if (picking) return;
    setPicking(true);
    setError(null);
    try {
      const picked = p.id === 0
        ? await createGeoPlace({ name: p.name, latitude: p.lat, longitude: p.lng, address: p.address, district: p.district, street: p.street })
        : p;
      setPlace(picked);
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

  // автосохранение черновика
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, tags, place })); } catch { /* ignore */ }
  }, [title, body, tags, place]);

  const [geoLocating, setGeoLocating] = useState(false);

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
      resolveGeo(latitude, longitude);
      try { setNearby(await fetchNearbyThreads(latitude, longitude)); } catch { /* ignore */ }
    } catch {
      setError("Не можем определить местоположение — разрешите доступ в браузере");
    } finally {
      setGeoLocating(false);
    }
  };

  const onPinMove = (latitude: number, longitude: number) => {
    setPendingGeo({ latitude, longitude });
    resolveGeo(latitude, longitude);
    fetchNearbyThreads(latitude, longitude).then(setNearby).catch(() => { /* ignore */ });
  };

  const publish = async () => {
    if (!body.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      let placeId = place && place.id > 0 ? place.id : null;
      if (!placeId && pendingGeo) {
        const p = await createGeoPlace({
          name: pendingLabel?.name || "Точка на карте",
          latitude: pendingGeo.latitude, longitude: pendingGeo.longitude,
          address: pendingLabel?.address || null,
        });
        placeId = p.id;
      }
      const t = await createThread({ title: title || null, body_md: body, place_id: placeId, tags });
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
        <Link href="/login" className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
          Войдите, чтобы задать вопрос →
        </Link>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={150}
        placeholder="Заголовок (необязательно — для важного)"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-lime-500"
      />

      <MdEditor value={body} onChange={setBody} placeholder="Опишите вопрос… @ — человек, + — место, # — тема" />

      <TagPicker value={tags} onChange={setTags} />

      {/* фото */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-700">
          <ImagePlus className="h-5 w-5" /> Добавить фото{files.length > 0 ? ` (${files.length})` : ""}
          <input
            type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => {
              setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {thumbs.map((src, i) => (
              <span key={`${files[i]?.name}-${files[i]?.size}-${i}`} className="relative overflow-hidden rounded-xl bg-slate-100">
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

      {/* точка */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-bold"><MapPin className="h-4 w-4 text-emerald-600" /> Место</span>
          {place || pendingGeo ? (
            <button onClick={() => { setPlace(null); setPendingGeo(null); setPendingLabel(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500"><X className="h-4 w-4" /> убрать</button>
          ) : (
            <button onClick={useGeolocation} disabled={geoLocating} className="text-xs font-bold text-emerald-700 disabled:opacity-50">
              {geoLocating ? "Определяем…" : "Моя геолокация"}
            </button>
          )}
        </div>
        {place ? (
          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
            <div className="font-bold text-emerald-800">{place.name}</div>
            <div className="text-xs text-emerald-600">{[place.address, place.district].filter(Boolean).join(" · ")}</div>
          </div>
        ) : pendingGeo ? (
          <div className="mt-2 overflow-hidden rounded-xl bg-emerald-50">
            <div className="px-3 pt-2.5">
              <div className="font-bold text-emerald-800">
                {resolving ? "Определяем адрес…" : (pendingLabel?.name ?? "Точка на карте")}
              </div>
              {pendingLabel?.address && !resolving && (
                <div className="truncate text-xs text-emerald-600">{pendingLabel.address}</div>
              )}
              <div className="pb-1 text-[11px] text-emerald-600/70">Метку можно перетащить</div>
            </div>
            <div className="p-1.5">
              <MiniMap lat={pendingGeo.latitude} lng={pendingGeo.longitude} onMove={onPinMove} />
            </div>
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
              <button key={`${p.id}-${p.name}`} disabled={picking} onClick={() => pickFound(p)} className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0"><span className="block truncate text-sm font-bold">{p.name}</span><span className="block truncate text-xs text-slate-500">{p.address}</span></span>
              </button>
            ))}
          </>
        )}
        {nearby.length > 0 && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
            <div className="text-xs font-bold text-amber-800">Рядом уже обсуждают ({nearby.length}) — гляньте, чтобы не дублировать:</div>
            {nearby.map((n) => (
              <a key={n.id} href={`/thread/${n.id}`} className="mt-1 block truncate text-[13px] text-amber-900 underline">
                #{n.id} {cleanSnippet(n.body_md)} {n.place_name ? `· ${n.place_name}` : ""}
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
      <p className="pb-24 text-center text-xs text-slate-400 md:pb-8">Черновик сохраняется автоматически</p>
    </div>
  );
}
