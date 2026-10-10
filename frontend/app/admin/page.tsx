"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка админ-данных с сервера */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

interface AdminUser { id: number; username: string; email: string; role: string; badge?: string | null; created_at: string; }
interface Report { id: number; reporter_id: number; reporter?: string; thread_id?: number | null; comment_id?: number | null; reason: string; text?: string | null; status: string; }

const REASONS: Record<string, string> = { spam: "Спам", abuse: "Оскорбления", offtopic: "Не по теме", other: "Другое" };

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.get("/admin/users"), api.get("/admin/reports")]);
      setUsers(u.data); setReports(r.data);
      setDenied(false);
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load, user]);

  const changeRole = async (u: AdminUser) => {
    if (user && u.id === user.id && u.role === "admin") {
      toast("Нельзя снять админа с себя", "error");
      return;
    }
    if (!window.confirm(`${u.role === "admin" ? "Снять админа" : "Сделать админом"} @${u.username}?`)) return;
    try {
      await api.patch(`/admin/users/${u.id}`, { role: u.role === "admin" ? "user" : "admin" });
      toast("Роль обновлена", "success");
      load();
    } catch {
      toast("Не получилось", "error");
    }
  };

  const resetPassword = async (u: AdminUser) => {
    const pw = window.prompt(`Новый пароль для @${u.username} (мин. 6 символов):`);
    if (!pw) return;
    if (pw.length < 6) { toast("Пароль короче 6 символов", "error"); return; }
    try {
      await api.patch(`/admin/users/${u.id}/password`, { password: pw });
      toast(`Пароль @${u.username} обновлён — передайте его пользователю`, "success");
    } catch {
      toast("Не получилось", "error");
    }
  };

  const toggleBadge = async (u: AdminUser) => {
    try {
      await api.patch(`/admin/users/${u.id}/badge`, { badge: u.badge === "official" ? null : "official" });
      toast(u.badge === "official" ? "Бейдж снят" : "Аккаунт верифицирован", "success");
      load();
    } catch {
      toast("Не получилось", "error");
    }
  };

  const resolveReport = async (id: number, status: "reviewed" | "rejected") => {
    try {
      await api.patch(`/admin/reports/${id}`, { status });
      load();
    } catch {
      toast("Не получилось", "error");
    }
  };

  const deleteThread = async (id: number) => {
    if (!window.confirm(`Удалить тред #${id} вместе с комментариями?`)) return;
    try {
      await api.delete(`/admin/threads/${id}`);
      toast("Тред удалён", "success");
      load();
    } catch {
      toast("Не получилось", "error");
    }
  };

  if (!authLoading && user && user.role !== "admin") {
    return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Только для администратора</div>;
  }
  if (denied) {
    return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Нет доступа. <Link href="/login" className="underline">Войти</Link></div>;
  }
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-3 pt-6">
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const fresh = reports.filter((r) => r.status === "new");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 pt-4 md:px-0 md:pt-6">
      <h1 className="text-xl font-extrabold">Админка</h1>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-bold">Пользователи · {users.length}</div>
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-50 px-4 py-2 text-sm last:border-0">
            <Link href={`/user/${u.username}`} className="font-bold hover:underline">@{u.username}</Link>
            <span className="hidden truncate text-slate-400 sm:inline">{u.email}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.role === "admin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{u.role}</span>
            <button
              onClick={() => toggleBadge(u)}
              title="Верифицированная организация"
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.badge === "official" ? "bg-sky-100 text-sky-700" : "border border-slate-200 text-slate-400"}`}
            >
              {u.badge === "official" ? "✓ official" : "official?"}
            </button>
            <button
              onClick={() => changeRole(u)}
              className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
            >
              {u.role === "admin" ? "снять админа" : "сделать админом"}
            </button>
            <button
              onClick={() => resetPassword(u)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
            >
              сбросить пароль
            </button>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-bold">Жалобы · новых: {fresh.length} / всего: {reports.length}</div>
        {reports.length === 0 && <div className="px-4 py-4 text-center text-sm text-slate-400">Жалоб нет</div>}
        {reports.map((r) => (
          <div key={r.id} className="border-b border-slate-50 px-4 py-2.5 text-sm last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">{REASONS[r.reason] ?? r.reason}</span>
              <span className="text-slate-500">#{r.id} · @{r.reporter ?? r.reporter_id}</span>
              {r.thread_id && <Link href={`/thread/${r.thread_id}`} className="font-bold text-emerald-700 hover:underline">тред #{r.thread_id}</Link>}
              <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${r.status === "new" ? "bg-amber-100 font-bold text-amber-800" : "bg-slate-100 text-slate-400"}`}>
                {r.status === "new" ? "новая" : r.status === "reviewed" ? "разобрана" : "отклонена"}
              </span>
            </div>
            {r.text && <div className="mt-1 text-[13px] text-slate-600">{r.text}</div>}
            {r.status === "new" && (
              <div className="mt-1.5 flex gap-1.5">
                {r.thread_id && (
                  <button onClick={() => deleteThread(r.thread_id!)} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500">
                    Удалить тред
                  </button>
                )}
                <button onClick={() => resolveReport(r.id, "reviewed")} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
                  Разобрана
                </button>
                <button onClick={() => resolveReport(r.id, "rejected")} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
                  Отклонить
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
