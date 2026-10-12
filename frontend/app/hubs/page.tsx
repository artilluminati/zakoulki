"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка разделов с сервера */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, MapPinned, ChevronDown, MessageCircle, MessagesSquare, Plus } from "lucide-react";
import { fetchThreads } from "@/lib/v5";
import type { ThreadV5 } from "@/types/v5";
import { useScope, scopeLabel } from "@/lib/scope";
import { scopeParams } from "@/lib/v5";
import ScopePicker from "@/components/ScopePicker";

export default function HubsPage() {
  const { scope, setScope } = useScope();
  const [hubs, setHubs] = useState<ThreadV5[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
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

  const reload = () => {
    setLoading(true);
    fetchThreads({ is_hub: true, limit: 50, ...scopeParams(scope) })
      .then(setHubs)
      .catch(() => setHubs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold dark:text-neutral-100">Разделы</h1>
          <div ref={scopeRef} className="relative ml-auto">
            <button
              onClick={() => setScopeOpen(!scopeOpen)}
              className="flex max-w-44 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <MapPinned className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{scopeLabel(scope)}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-500" />
            </button>
            {scopeOpen && (
              <div className="absolute right-0 z-30 mt-1 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <ScopePicker value={scope} onChange={(s) => { setScope(s); setScopeOpen(false); }} />
              </div>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">
          Разделы мест: вопросы одного двора, парка или улицы — в одном месте.
        </p>
        <Link
          href="/create?newhub=1"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Создать новый раздел
        </Link>
      </div>
      {loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />)}</div>
      ) : hubs.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950">
            <MessagesSquare className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold dark:text-neutral-100">Разделов пока нет</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Три голоса жителей превращают вопрос с местом в раздел.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hubs.map((h) => (
            <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/thread/${h.id}`} className="min-w-0 flex-1 truncate text-[16px] font-extrabold leading-snug hover:underline dark:text-neutral-100">
                  {h.title || "Раздел"}
                </Link>
                <span className="flex shrink-0 items-center gap-1 text-[13px] text-slate-500 dark:text-neutral-400">
                  <MessageCircle className="h-3.5 w-3.5" />{h.comments_count}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {h.place && (
                  <Link href={`/map?place=${h.place.id}`} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
                    <MapPin className="h-3 w-3" />{h.place.name}
                  </Link>
                )}
                {(h.attached_count ?? 0) > 0 && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                    вопросов: {h.attached_count}
                  </span>
                )}
                {h.talk_id && (
                  <Link href={`/thread/${h.talk_id}`} className="font-semibold text-slate-500 hover:text-slate-800 dark:text-neutral-400">
                    Обсуждение →
                  </Link>
                )}
                <Link href={`/create?hub=${h.id}`} className="ml-auto font-bold text-emerald-700 hover:underline dark:text-emerald-300">
                  Задать вопрос +
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
