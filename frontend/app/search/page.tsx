"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка результатов поиска с сервера */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, X } from "lucide-react";
import ThreadCard from "@/components/ThreadCard";
import { fetchThreads, searchGeoPlaces } from "@/lib/v5";
import type { ThreadV5, GeoPlaceV5 } from "@/types/v5";

export default function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState<"threads" | "places">("threads");
  const [threads, setThreads] = useState<ThreadV5[]>([]);
  const [places, setPlaces] = useState<GeoPlaceV5[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (text: string) => {
    const query = text.trim();
    if (query.length < 2) return;
    setLoading(true);
    setFailed(false);
    router.replace(`/search?q=${encodeURIComponent(query)}`);
    try {
      const [t, p] = await Promise.all([
        fetchThreads({ search: query, limit: 30 }),
        searchGeoPlaces(query).catch(() => [] as GeoPlaceV5[]),
      ]);
      setThreads(t);
      setPlaces(p);
    } catch {
      setFailed(true);
      setThreads([]);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial.trim().length >= 2) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    setQ("");
    setThreads([]);
    setPlaces([]);
    setFailed(false);
    router.replace("/search");
  };

  const list = tab === "threads" ? threads : places;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <form
        onSubmit={(e) => { e.preventDefault(); run(q); }}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <Search className="h-5 w-5 shrink-0 text-slate-400 dark:text-neutral-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="Вопросы, места, адреса…"
          maxLength={100}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400 dark:placeholder:text-neutral-500"
        />
        {q && (
          <button type="button" onClick={clear} aria-label="Очистить" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:text-neutral-500 dark:hover:bg-neutral-800">
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="flex gap-1.5 text-[13px]">
        {(["threads", "places"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`rounded-full px-3.5 py-1.5 font-bold ${tab === tb ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"}`}
          >
            {tb === "threads" ? `Вопросы · ${threads.length}` : `Места · ${places.length}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : failed ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          Не загрузилось — проверьте соединение.
          <button onClick={() => run(q)} className="mt-2 block w-full font-bold text-emerald-700 dark:text-emerald-300">Повторить</button>
        </div>
      ) : !initial && threads.length === 0 && places.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-800">
            <Search className="h-7 w-7 text-slate-300 dark:text-neutral-500" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold">Что ищем?</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Вопросы горожан и места на карте — от двух букв.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
          Ничего не нашли. Попробуйте другие слова.
        </div>
      ) : tab === "threads" ? (
        <div className="space-y-3">{threads.map((t) => <ThreadCard key={t.id} t={t} />)}</div>
      ) : (
        <div className="space-y-2">
          {places.map((p) => (
            <Link
              key={`${p.id}-${p.name}`}
              href={p.id > 0 ? `/map?place=${p.id}` : `/map`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:border-emerald-300 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950">
                <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold">{p.name}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">
                  {[p.address, p.district].filter(Boolean).join(" · ") || "Точка на карте"}
                  {p.id === 0 ? " · Яндекс" : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
