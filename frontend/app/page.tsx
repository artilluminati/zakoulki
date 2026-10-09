"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты ниже синхронизируют состояние с сервером/localStorage, это их прямая задача */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ThreadCard from "@/components/ThreadCard";
import MdEditor from "@/components/editor/MdEditor";
import { fetchThreads, createThread } from "@/lib/v5";
import { api } from "@/lib/api";
import type { ThreadV5 } from "@/types/v5";
import { useAuth } from "@/lib/auth";

function CategoryChip({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    api.get("/categories").then((r) => {
      const c = (r.data as { id: number; name: string }[]).find((x) => x.id === Number(id));
      setName(c?.name ?? `#${id}`);
    }).catch(() => setName(`#${id}`));
  }, [id]);
  return (
    <Link href="/" className="flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-[13px] font-bold text-emerald-700">
      {name ?? "…"} ✕
    </Link>
  );
}

type Sort = "new" | "top" | "near";

export default function FeedPage() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const categoryParam = params.get("category");
  const { user } = useAuth();
  const [items, setItems] = useState<ThreadV5[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("new");
  const [filter, setFilter] = useState<"all" | "important" | "offtop">("all");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchThreads({
        search: search || undefined,
        category_id: categoryParam ? Number(categoryParam) : undefined,
        sort: sort === "near" ? "near" : sort,
        ...(sort === "near" && geo ? { lat: geo.lat, lng: geo.lng, radius: 10 } : {}),
        has_geo: filter === "important" ? true : filter === "offtop" ? false : undefined,
        is_offtop: filter === "offtop" ? true : undefined,
        limit: 20,
      });
      setItems(data);
    } catch { setItems([]); }
    setLoading(false);
  }, [sort, filter, search, categoryParam, geo]);

  useEffect(() => { load(); }, [load]);

  const pickSort = (s: Sort) => {
    setGeoError(false);
    if (s === "near" && !geo) {
      if (!("geolocation" in navigator)) {
        setGeoError(true);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => setGeoError(true),
          { timeout: 8000 }
        );
      }
    }
    setSort(s);
  };

  const post = async () => {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      await createThread({ body_md: draft });
      setDraft("");
      load();
    } catch {}
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
        {categoryParam && (
          <CategoryChip id={categoryParam} />
        )}
      </div>

      {sort === "near" && !geo && !geoError && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center text-[13px] text-slate-500">
          Определяем ваше местоположение…
        </div>
      )}
      {sort === "near" && geoError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-center text-[13px] text-amber-800">
          Не можем определить местоположение — показываем новое
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <div className="text-5xl">🏘</div>
          <h2 className="mt-2 text-lg font-extrabold">Пока тихо</h2>
          <p className="text-sm text-slate-500">Станьте первым — спросите город.</p>
          <Link href="/create" className="mt-3 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Создать вопрос</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((t) => <ThreadCard key={t.id} t={t} />)}
          <div className="py-6 text-center text-sm text-slate-400">Вы все прочитали 🎉</div>
        </div>
      )}
    </div>
  );
}
