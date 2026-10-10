"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка подборки с сервера */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ThreadCard from "@/components/ThreadCard";
import { fetchThreads } from "@/lib/v5";
import type { ThreadV5 } from "@/types/v5";

export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [items, setItems] = useState<ThreadV5[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    fetchThreads({ tag: decodeURIComponent(tag), limit: 30 })
      .then(setItems)
      .catch(() => { setItems([]); setFailed(true); })
      .finally(() => setLoading(false));
  }, [tag]);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <Link href="/" className="text-sm text-slate-400">← Лента</Link>
      <h1 className="text-xl font-extrabold">{decodeURIComponent(tag)}</h1>
      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white" />)}</div>
      ) : failed ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-sm text-slate-500">
          Не загрузилось — проверьте соединение и обновите страницу.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          По этому тегу пока пусто
        </div>
      ) : (
        <div className="space-y-3">{items.map((t) => <ThreadCard key={t.id} t={t} />)}</div>
      )}
    </div>
  );
}
