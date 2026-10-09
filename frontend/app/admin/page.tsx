"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface AdminUser { id: number; username: string; email: string; role: string; created_at: string; }
interface Report { id: number; reporter_id: number; thread_id?: number | null; comment_id?: number | null; reason: string; text?: string | null; status: string; }

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [denied, setDenied] = useState(false);

  const load = async () => {
    try {
      const [u, r] = await Promise.all([api.get("/admin/users"), api.get("/admin/reports")]);
      setUsers(u.data); setReports(r.data);
    } catch { setDenied(true); }
  };
  useEffect(() => { load(); }, []);

  if (user && user.role !== "admin") return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Только для администратора</div>;
  if (denied) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Нет доступа. <Link href="/login" className="underline">Войти</Link></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 pt-4 md:px-0 md:pt-6">
      <h1 className="text-xl font-extrabold">Админка</h1>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-bold">Пользователи · {users.length}</div>
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2 text-sm last:border-0">
            <Link href={`/user/${u.username}`} className="font-bold hover:underline">@{u.username}</Link>
            <span className="text-slate-400">{u.email}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${u.role === "admin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>{u.role}</span>
            <button
              onClick={async () => {
                await api.patch(`/admin/users/${u.id}`, { role: u.role === "admin" ? "user" : "admin" });
                load();
              }}
              className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-slate-50"
            >
              {u.role === "admin" ? "снять админа" : "сделать админом"}
            </button>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2 text-sm font-bold">Жалобы · {reports.length}</div>
        {reports.length === 0 && <div className="px-4 py-4 text-center text-sm text-slate-400">Жалоб нет</div>}
        {reports.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-slate-50 px-4 py-2 text-sm last:border-0">
            <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">{r.reason}</span>
            <span className="text-slate-500">#{r.id} от {r.reporter_id}</span>
            {r.thread_id && <Link href={`/thread/${r.thread_id}`} className="font-bold text-emerald-700 hover:underline">тред #{r.thread_id}</Link>}
            <span className="ml-auto text-xs text-slate-400">{r.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
