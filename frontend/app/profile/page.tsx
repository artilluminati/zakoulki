"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { fetchThreads } from "@/lib/v5";
import { api } from "@/lib/api";
import ThreadCard, { timeAgo } from "@/components/ThreadCard";
import type { ThreadV5 } from "@/types/v5";

interface Notif { id: string | number; kind: string; author?: string; author_id?: number; thread_id?: number | null; comment_id?: number | null; title?: string | null; snippet?: string; created_at?: string; }

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const [mine, setMine] = useState<ThreadV5[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    if (user) {
      fetchThreads({ author_id: user.id, limit: 50 }).then(setMine).catch(() => {});
      api.get("/threads/notifications/mine").then((r) => setNotifs(r.data ?? [])).catch(() => {});
    }
  }, [user]);

  if (loading) return <div className="mx-auto max-w-2xl px-3 pt-10">Загружаем…</div>;
  if (!user) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Войдите. <Link href="/login" className="underline">Войти</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-200 text-2xl font-extrabold">{user.username.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="text-lg font-extrabold">@{user.username}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
            <div className="text-xs text-slate-400">с нами с {new Date(user.created_at).toLocaleDateString("ru-RU")}</div>
          </div>
          <button onClick={logout} className="ml-auto rounded-xl border border-slate-200 px-3 py-1.5 text-sm">Выйти</button>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <span><b>{mine.length}</b> <span className="text-slate-500">вопросов</span></span>
          {user.role === "admin" && <Link href="/admin" className="font-bold text-emerald-700">Админка →</Link>}
        </div>
      </div>
      <h2 className="font-extrabold">Мои вопросы</h2>
      <div className="space-y-3">
        {mine.map((t) => <ThreadCard key={t.id} t={t} />)}
        {mine.length === 0 && <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400">Пока пусто. <Link href="/create" className="font-bold text-emerald-700">Спросить →</Link></div>}
      </div>

      {notifs.length > 0 && (
        <>
          <h2 className="font-extrabold">Уведомления</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {notifs.map((n) => (
              <Link
                key={String(n.id)}
                href={n.thread_id ? `/thread/${n.thread_id}${n.comment_id ? `#comment-${n.comment_id}` : ""}` : "/"}
                className="block border-b border-slate-50 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50"
              >
                <span className="font-bold">{n.author ?? "Кто-то"}</span>
                <span className="text-slate-500"> {n.kind === "mention" ? "упомянул(а) вас" : "ответил(а) в вашем треде"}</span>
                {n.snippet && <span className="mt-0.5 block truncate text-xs text-slate-400">{n.snippet}</span>}
                {n.created_at && <span className="mt-0.5 block text-[11px] text-slate-300">{timeAgo(n.created_at)}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
