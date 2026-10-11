"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты ниже синхронизируют состояние с сервером/localStorage, это их прямая задача */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ThreadCard from "@/components/ThreadCard";
import QuickComposer from "@/components/QuickComposer";
import { fetchThreads, createThread, uploadThreadPhoto, scopeParams } from "@/lib/v5";
import { MessagesSquare, CheckCircle2 } from "lucide-react";
import type { ThreadV5 } from "@/types/v5";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useScope, scopeLabel } from "@/lib/scope";
import ScopePicker from "@/components/ScopePicker";
import { MapPinned, ChevronDown } from "lucide-react";

type Sort = "new" | "top" | "near";

export default function FeedPage() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const { user } = useAuth();
  const toast = useToast();
  const { scope, setScope } = useScope();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [items, setItems] = useState<ThreadV5[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<Sort>("new");
  const [filter, setFilter] = useState<"all" | "hubs" | "offtop" | "resolved">("all");
  const scopeRef = useRef<HTMLDivElement>(null);

  // закрытие поповера региона по клику вне
  useEffect(() => {
    if (!scopeOpen) return;
    const handler = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [scopeOpen]);

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

  // лёгкий поллинг новых (только сортировка «новые»): раз в 30с, только когда
  // вкладка видна; новые не вставляем сами — показываем пилюлю, чтобы не прыгала лента
  const [pending, setPending] = useState<ThreadV5[]>([]);
  useEffect(() => {
    setPending([]);
    if (sort !== "new") return;
    let alive = true;
    let fails = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        if (document.visibilityState === "visible" && itemsRef.current.length > 0) {
          const data = await fetchThreads({
            search: search || undefined,
            sort: "new",
            has_geo: filter === "offtop" ? false : undefined,
        is_hub: filter === "hubs" ? true : undefined,
        is_resolved: filter === "resolved" ? true : undefined,
            is_offtop: filter === "offtop" ? true : undefined,
            ...scopeParams(scope),
            limit: PAGE,
            after_id: itemsRef.current[0].id,
          });
          if (alive && data.length > 0) {
            setPending((prev) => {
              const known = new Set([...itemsRef.current.map((t) => t.id), ...prev.map((t) => t.id)]);
              const fresh = data.filter((t) => !known.has(t.id));
              return [...fresh, ...prev].slice(0, PAGE);
            });
            fails = 0;
          } else if (alive) {
            fails = 0;
          }
        }
      } catch {
        fails = Math.min(fails + 1, 3);
      }
      if (alive) timer = setTimeout(tick, 30000 * 2 ** fails);
    };
    timer = setTimeout(tick, 30000);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, filter, search, geo, scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchThreads({
        search: search || undefined,
        sort: sort === "near" ? "near" : sort,
        ...(sort === "near" && geo ? { lat: geo.lat, lng: geo.lng, radius: 10 } : {}),
        has_geo: filter === "offtop" ? false : undefined,
        is_hub: filter === "hubs" ? true : undefined,
        is_resolved: filter === "resolved" ? true : undefined,
        is_offtop: filter === "offtop" ? true : undefined,
        ...scopeParams(scope),
        limit: PAGE,
      });
      setItems(data);
      setHasMore(data.length === PAGE);
    } catch {
      setItems([]); setLoadError(true);
    }
    setLoading(false);
  }, [sort, filter, search, geo, scope]);

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
        has_geo: filter === "offtop" ? false : undefined,
        is_hub: filter === "hubs" ? true : undefined,
        is_resolved: filter === "resolved" ? true : undefined,
        is_offtop: filter === "offtop" ? true : undefined,
        ...scopeParams(scope),
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

  const post = async (body: string, files: File[]) => {
    try {
      const t = await createThread({
        body_md: body,
        city: scope.city ?? null, district: scope.district ?? null,
        region: scope.region ?? null, country: scope.country ?? null,
      });
      for (const f of files) {
        try { await uploadThreadPhoto(t.id, f); } catch { /* ignore */ }
      }
      toast("Опубликовано", "success");
      load();
    } catch {
      toast("Не опубликовалось — попробуйте ещё раз", "error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      {/* композер */}
      {user ? (
        <QuickComposer expandHref="/create" onSubmit={post} />
      ) : (
        <Link href="/login" className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          Войдите, чтобы спросить город →
        </Link>
      )}

      {/* сортировка + фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <div ref={scopeRef} className="relative">
          <button
            onClick={() => setScopeOpen(!scopeOpen)}
            className="flex max-w-44 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <MapPinned className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{scopeLabel(scope)}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-500" />
          </button>
          {scopeOpen && (
            <div className="absolute left-0 z-30 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              <ScopePicker value={scope} onChange={(s) => { setScope(s); setScopeOpen(false); }} />
            </div>
          )}
        </div>
        {search && (
          <Link href="/" className="flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-[13px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Поиск: {search} ✕
          </Link>
        )}
        <div className="flex rounded-full bg-white p-1 text-sm shadow-sm border border-slate-200 dark:bg-neutral-900 dark:border-neutral-700">
          {(["new", "top", "near"] as Sort[]).map((s) => (
            <button key={s} onClick={() => pickSort(s)} className={`rounded-full px-3 py-1.5 font-semibold ${sort === s ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}>
              {s === "new" ? "Новые" : s === "top" ? "Обсуждают" : "Рядом"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 text-[13px]">
          {(["all", "hubs", "offtop", "resolved"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1.5 font-semibold ${filter === f ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "border-slate-200 bg-white text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"}`}>
              {f === "all" ? "Все" : f === "hubs" ? "Разделы" : f === "resolved" ? "Решённые" : "Оффтоп"}
            </button>
          ))}
        </div>
      </div>

      {sort === "near" && geoPending && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-[13px] text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Определяем ваше местоположение…
        </div>
      )}
      {sort === "near" && geoError && !geoPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-[13px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Не можем определить местоположение — разрешите доступ в браузере или показываем новое.
          <button onClick={requestGeo} className="ml-2 font-bold underline">Попробовать снова</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm dark:bg-neutral-900" />)}</div>
      ) : loadError ? (
        <div className="rounded-3xl border border-red-200 bg-white p-10 text-center dark:bg-neutral-900">
          <h2 className="text-lg font-extrabold">Не загрузилось</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Проверьте соединение и попробуйте снова.</p>
          <button onClick={() => load()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Повторить</button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-100">
            <MessagesSquare className="h-7 w-7 text-lime-700 dark:text-lime-300" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold">Пока тихо</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Станьте первым — спросите город.</p>
          <Link href="/create" className="mt-3 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition active:scale-95">Создать вопрос</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <button
              onClick={() => { setItems((prev) => [...pending, ...prev]); setPending([]); }}
              className="w-full rounded-2xl bg-lime-300 py-2.5 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-lime-200 active:scale-[0.99]"
            >
              {pending.length} {pending.length === 1 ? "новый вопрос" : pending.length < 5 ? "новых вопроса" : "новых вопросов"} — показать ↑
            </button>
          )}
          {items.map((t) => <ThreadCard key={t.id} t={t} />)}
          {hasMore ? (
            <button onClick={loadMore} disabled={loadingMore} className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800">
              {loadingMore ? "Загружаем…" : "Показать ещё"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400 dark:text-neutral-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Вы все прочитали
            </div>
          )}
        </div>
      )}
    </div>
  );
}
