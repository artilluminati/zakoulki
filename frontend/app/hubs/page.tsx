"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка разделов с сервера */

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle, MessagesSquare, Plus, Search } from "lucide-react";
import { fetchThreads, createHub, createGeoPlace, searchGeoPlaces, reverseGeocode } from "@/lib/v5";
import type { GeoPlaceV5, ThreadV5 } from "@/types/v5";
import { useScope, scopeLabel } from "@/lib/scope";
import { scopeParams } from "@/lib/v5";

export default function HubsPage() {
  const { scope } = useScope();
  const [hubs, setHubs] = useState<ThreadV5[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pq, setPq] = useState("");
  const [pfound, setPfound] = useState<GeoPlaceV5[]>([]);
  const [pplace, setPplace] = useState<GeoPlaceV5 | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (pq.trim().length < 3) { setPfound([]); return; }
    const t = setTimeout(async () => {
      try { setPfound(await searchGeoPlaces(pq.trim())); } catch { setPfound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [pq]);

  const create = async () => {
    if (title.trim().length < 2 || !pplace || busy) return;
    setBusy(true);
    try {
      let pid = pplace.id;
      if (pid <= 0) {
        const r = await reverseGeocode(pplace.lat, pplace.lng).catch(() => null);
        const created = await createGeoPlace({
          name: pplace.name, latitude: pplace.lat, longitude: pplace.lng,
          address: pplace.address || r?.address || null, district: pplace.district || r?.district || null,
          street: pplace.street || r?.street || null,
          city: pplace.city || r?.city || scope.city || null,
          region: pplace.region || r?.region || scope.region || null,
          country: pplace.country || r?.country || scope.country || "Россия",
        });
        pid = created.id;
      }
      await createHub(pid, title.trim());
      setTitle(""); setPq(""); setPfound([]); setPplace(null);
      setFormOpen(false);
      reload();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <div>
        <h1 className="text-xl font-extrabold dark:text-neutral-100">Разделы</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">
          Разделы мест: вопросы одного двора, парка или улицы — в одном месте. {scopeLabel(scope) !== "Вся Россия" && <>Показаны: {scopeLabel(scope)}.</>}
        </p>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Создать новый раздел
        </button>
        {formOpen && (
          <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название раздела…"
              maxLength={150}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            {!pplace ? (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={pq}
                    onChange={(e) => setPq(e.target.value)}
                    placeholder="Место раздела: найти…"
                    maxLength={100}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
                {pfound.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-neutral-700">
                    {pfound.slice(0, 6).map((p) => (
                      <button
                        key={`${p.id}-${p.name}`}
                        type="button"
                        onClick={() => { setPplace(p); setPq(""); setPfound([]); }}
                        className="block w-full truncate px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-neutral-800"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-neutral-800">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate font-semibold">{pplace.name}</span>
                <button type="button" onClick={() => setPplace(null)} className="shrink-0 text-xs font-bold text-slate-400 hover:text-red-500">сменить</button>
              </div>
            )}
            <button
              onClick={create}
              disabled={busy || title.trim().length < 2 || !pplace}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Создать раздел
            </button>
          </div>
        )}
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
