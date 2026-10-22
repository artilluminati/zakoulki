"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка админ-данных с сервера */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { timeAgo } from "@/components/ThreadCard";
import CategoriesAdmin from "@/components/admin/CategoriesAdmin";
import UsersAdmin from "@/components/admin/UsersAdmin";
import HubsAdmin from "@/components/admin/HubsAdmin";
import PlacesAdmin from "@/components/admin/PlacesAdmin";
import DonationsAdmin from "@/components/admin/DonationsAdmin";
import RecommendationsAdmin from "@/components/admin/RecommendationsAdmin";
import { errMessage } from "@/components/admin/common";

interface Report { id: number; reporter_id: number; reporter?: string; thread_id?: number | null; comment_id?: number | null; reason: string; text?: string | null; status: string; }
interface AdminThread { id: number; author?: string | null; title?: string | null; snippet: string; is_offtop: boolean; is_hub: boolean; place_id?: number | null; comments_count: number; created_at: string; }
interface Stats { users: number; threads: number; places: number; reports_new: number; donations: number; donations_paid: number; recommendations_pending: number; }

const REASONS: Record<string, string> = { spam: "Спам", abuse: "Оскорбления", offtopic: "Не по теме", other: "Другое" };

type Tab = "reports" | "users" | "threads" | "categories" | "hubs" | "places" | "donations" | "recommendations";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<"new" | "all">("new");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, t, s] = await Promise.all([
        api.get("/admin/reports", { params: reportFilter === "new" ? { status: "new" } : {} }),
        api.get("/admin/threads"),
        api.get("/admin/stats"),
      ]);
      setReports(r.data); setThreads(t.data); setStats(s.data);
      setDenied(false);
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, [reportFilter]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load, user]);

  const resolveReport = async (id: number, status: "reviewed" | "rejected") => {
    try {
      await api.patch(`/admin/reports/${id}`, { status });
      toast(status === "reviewed" ? "Жалоба разобрана" : "Жалоба отклонена", "success");
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось"), "error");
    }
  };

  const deleteThread = async (id: number) => {
    if (!await confirm({ title: `Удалить тред #${id} вместе с комментариями?`, ok: "Удалить", danger: true })) return;
    try {
      await api.delete(`/admin/threads/${id}`);
      toast("Тред удалён", "success");
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось удалить тред"), "error");
    }
  };

  if (!authLoading && user && user.role !== "admin") {
    return <div className="mx-auto max-w-2xl px-3 pt-10 text-center dark:text-neutral-200">Только для администратора</div>;
  }
  if (denied) {
    return <div className="mx-auto max-w-2xl px-3 pt-10 text-center dark:text-neutral-200">Нет доступа. <Link href="/login" className="underline">Войти</Link></div>;
  }
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-3 pt-6">
        <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
        <div className="h-32 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "reports", label: "Жалобы", badge: stats?.reports_new },
    { id: "users", label: "Пользователи" },
    { id: "threads", label: "Треды" },
    { id: "categories", label: "Категории" },
    { id: "hubs", label: "Разделы" },
    { id: "places", label: "Места" },
    { id: "donations", label: "Донаты" },
    { id: "recommendations", label: "Рекомендации", badge: stats?.recommendations_pending },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 pt-4 md:px-0 md:pt-6">
      <h1 className="text-xl font-extrabold dark:text-neutral-100">Админка</h1>

      {stats && (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[
              { v: stats.users, l: "юзеров" },
              { v: stats.threads, l: "тредов" },
              { v: stats.places, l: "мест" },
              { v: stats.reports_new, l: "жалоб" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xl font-extrabold dark:text-neutral-100">{s.v}</div>
                <div className="text-xs text-slate-500 dark:text-neutral-400">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: stats.donations, l: "донатов" },
              { v: stats.donations_paid, l: "оплачено" },
              { v: stats.recommendations_pending, l: "заявок" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <div className="text-xl font-extrabold dark:text-neutral-100">{s.v}</div>
                <div className="text-xs text-slate-500 dark:text-neutral-400">{s.l}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* вкладки: на мобильном — горизонтальная прокрутка */}
      <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
        <div className="flex w-max gap-1.5 pb-1 sm:w-full sm:flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:text-slate-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {t.label}
              {!!t.badge && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {tab === "users" && <UsersAdmin />}

      {tab === "categories" && <CategoriesAdmin />}

      {tab === "hubs" && <HubsAdmin />}

      {tab === "places" && <PlacesAdmin />}

      {tab === "donations" && <DonationsAdmin />}

      {tab === "recommendations" && <RecommendationsAdmin />}

      {tab === "reports" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2 dark:border-neutral-800">
            <span className="text-sm font-bold dark:text-neutral-200">Жалобы</span>
            <span className="ml-auto flex gap-1 text-xs">
              {(["new", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setReportFilter(f)}
                  className={`rounded-lg px-2 py-1 font-bold ${reportFilter === f ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}
                >
                  {f === "new" ? "Новые" : "Все"}
                </button>
              ))}
            </span>
          </div>
          {reports.length === 0 && <div className="px-4 py-4 text-center text-sm text-slate-400 dark:text-neutral-500">Жалоб нет</div>}
          {reports.map((r) => (
            <div key={r.id} className="border-b border-slate-50 px-4 py-2.5 text-sm last:border-0 dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950 dark:text-red-400">{REASONS[r.reason] ?? r.reason}</span>
                <span className="text-slate-500 dark:text-neutral-400">#{r.id} · @{r.reporter ?? r.reporter_id}</span>
                {r.thread_id && <Link href={`/thread/${r.thread_id}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-400">тред #{r.thread_id}</Link>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${r.status === "new" ? "bg-amber-100 font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500"}`}>
                  {r.status === "new" ? "новая" : r.status === "reviewed" ? "разобрана" : "отклонена"}
                </span>
              </div>
              {r.text && <div className="mt-1 text-[13px] text-slate-600 dark:text-neutral-300">{r.text}</div>}
              {r.status === "new" && (
                <div className="mt-1.5 flex gap-1.5">
                  {r.thread_id && (
                    <button onClick={() => deleteThread(r.thread_id!)} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500">
                      Удалить тред
                    </button>
                  )}
                  <button onClick={() => resolveReport(r.id, "reviewed")} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                    Разобрана
                  </button>
                  <button onClick={() => resolveReport(r.id, "rejected")} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "threads" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-slate-100 px-4 py-2 text-sm font-bold dark:border-neutral-800 dark:text-neutral-200">Свежие треды · {threads.length}</div>
          {threads.map((t) => (
            <div key={t.id} className="border-b border-slate-50 px-4 py-2.5 text-sm last:border-0 dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/thread/${t.id}`} className="font-bold hover:underline dark:text-neutral-100">#{t.id}</Link>
                {t.author && <span className="text-slate-500 dark:text-neutral-400">@{t.author}</span>}
                {t.is_offtop && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">оффтоп</span>}
                {t.is_hub && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">раздел</span>}
                <span className="text-xs text-slate-400 dark:text-neutral-500">{timeAgo(t.created_at)} · {t.comments_count} комментов</span>
              </div>
              {(t.title || t.snippet) && <div className="mt-0.5 truncate text-[13px] text-slate-600 dark:text-neutral-300">{t.title ?? t.snippet}</div>}
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={() => deleteThread(t.id)} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500">
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
