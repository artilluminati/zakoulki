"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты ниже синхронизируют состояние с сервером/localStorage, это их прямая задача */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ThreadCard from "@/components/ThreadCard";
import MdEditor from "@/components/editor/MdEditor";
import { fetchThreads, createThread } from "@/lib/v5";
import { MessagesSquare, CheckCircle2 } from "lucide-react";
import type { ThreadV5 } from "@/types/v5";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

type Sort = "new" | "top" | "near";

export default function FeedPage() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<ThreadV5[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<Sort>("new");
  const [filter, setFilter] = useState<"all" | "important" | "offtop">("all");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [geoPending, setGeoPending] = useState(false);

  const requestGeo = async () => {
    setGeoError(false);
    setGeoPending(true);
    try {
      if (!("geolocation" in navigator)) throw new Error("unsupported");
      const withPerms = navigator as Navigator & { permissions?: { query(o: { name: string }): Promise<{ state: string }> } };
      if (withPerms.permissions?.query) {
        const st = await withPerms.permissions.query({ name: "geolocation" });
        if (st.state === "denied") throw new Error("denied");
      }
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setGeoError(true);
    } finally {
      setGeoPending(false);
    }
  };

  const PAGE = 20;
  const itemsRef = useRef<ThreadV5[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchThreads({
        search: search || undefined,
        sort: sort === "near" ? "near" : sort,
        ...(sort === "near" && geo ? { lat: geo.lat, lng: geo.lng, radius: 10 } : {}),
        has_geo: filter === "important" ? true : filter === "offtop" ? false : undefined,
        is_offtop: filter === "offtop" ? true : undefined,
        limit: PAGE,
      });
      setItems(data);
      setHasMore(data.length === PAGE);
    } catch {
      setItems([]); setLoadError(true);
    }
    setLoading(false);
  }, [sort, filter, search, geo]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    const last = itemsRef.current[itemsRef.current.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchThreads({
        search: search || undefined,
        sort: sort === "near" ? "near" : sort,
        ...(sort === "near" && geo ? { lat: geo.lat, lng: geo.lng, radius: 10 } : {}),
        has_geo: filter === "important" ? true : filter === "offtop" ? false : undefined,
        is_offtop: filter === "offtop" ? true : undefined,
        limit: PAGE,
        before_id: last.id,
      });
      setItems((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE);
    } catch {
      toast("Не получилось догрузить", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const pickSort = (s: Sort) => {
    if (s === "near" && !geo && !geoPending) requestGeo();
    setSort(s);
  };

  const post = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      await createThread({ body_md: draft });
      setDraft("");
      toast("Опубликовано", "success");
      load();
    } catch {
      toast("Не опубликовалось — попробуйте ещё раз", "error");
    }
    setPosting(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      {/* композер */}
      {user ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <MdEditor value={draft} onChange={setDraft} compact placeholder="О чем хотите спросить? @ — человек, + — место" />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">{draft.length}/5000 {draft.length > 280 ? "· вопрос" : "· оффтоп"}</span>
            <div className="flex gap-2">
              <Link href="/create" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Расширить</Link>
              <button onClick={post} disabled={!draft.trim() || posting} className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-slate-900 disabled:opacity-40 hover:bg-lime-300">
                {posting ? "…" : "Опубликовать"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Link href="/login" className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
          Войдите, чтобы спросить город →
        </Link>
      )}

      {/* сортировка + фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <Link href="/" className="flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-[13px] font-bold text-emerald-700">
            Поиск: {search} ✕
          </Link>
        )}
        <div className="flex rounded-full bg-white p-1 text-sm shadow-sm border border-slate-200">
          {(["new", "top", "near"] as Sort[]).map((s) => (
            <button key={s} onClick={() => pickSort(s)} className={`rounded-full px-3 py-1.5 font-semibold ${sort === s ? "bg-slate-900 text-white" : "text-slate-500"}`}>
              {s === "new" ? "Новые" : s === "top" ? "Обсуждают" : "Рядом"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 text-[13px]">
          {(["all", "important", "offtop"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1.5 font-semibold ${filter === f ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
              {f === "all" ? "Все" : f === "important" ? "Важное" : "Оффтоп"}
            </button>
          ))}
        </div>
      </div>

      {sort === "near" && geoPending && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-[13px] text-slate-500">
          Определяем ваше местоположение…
        </div>
      )}
      {sort === "near" && geoError && !geoPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-[13px] text-amber-800">
          Не можем определить местоположение — разрешите доступ в браузере или показываем новое.
          <button onClick={requestGeo} className="ml-2 font-bold underline">Попробовать снова</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div>
      ) : loadError ? (
        <div className="rounded-3xl border border-red-200 bg-white p-10 text-center">
          <h2 className="text-lg font-extrabold">Не загрузилось</h2>
          <p className="mt-1 text-sm text-slate-500">Проверьте соединение и попробуйте снова.</p>
          <button onClick={() => load()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Повторить</button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-100">
            <MessagesSquare className="h-7 w-7 text-lime-700" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold">Пока тихо</h2>
          <p className="mt-1 text-sm text-slate-500">Станьте первым — спросите город.</p>
          <Link href="/create" className="mt-3 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition active:scale-95">Создать вопрос</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => <ThreadCard key={t.id} t={t} />)}
          {hasMore ? (
            <button onClick={loadMore} disabled={loadingMore} className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50">
              {loadingMore ? "Загружаем…" : "Показать ещё"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Вы все прочитали
            </div>
          )}
        </div>
      )}
    </div>
  );
}
