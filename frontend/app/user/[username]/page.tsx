"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка профиля с сервера */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ThreadCard, { OfficialBadge } from "@/components/ThreadCard";
import { api } from "@/lib/api";
import { fetchThreads } from "@/lib/v5";
import type { User } from "@/types";
import type { ThreadV5 } from "@/types/v5";

export default function UserPage() {
  const { username } = useParams<{ username: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<ThreadV5[]>([]);
  const [missing, setMissing] = useState(false);
  const [threadsFailed, setThreadsFailed] = useState(false);

  useEffect(() => {
    const name = decodeURIComponent(username);
    setMissing(false);
    setThreadsFailed(false);
    api.get(`/users/by-username/${encodeURIComponent(name)}`)
      .then((r) => {
        setUser(r.data);
        fetchThreads({ author_id: r.data.id, limit: 30 })
          .then(setThreads)
          .catch(() => setThreadsFailed(true));
      })
      .catch(() => setMissing(true));
  }, [username]);

  if (missing) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Пользователь не найден. <Link href="/" className="underline">В ленту</Link></div>;
  if (!user) return <div className="mx-auto max-w-2xl px-3 pt-10">Загружаем…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-200 text-2xl font-extrabold">{user.username.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
              <span>@{user.username}</span>
              {user.badge === "official" && <OfficialBadge />}
            </div>
            <div className="text-xs text-slate-400 dark:text-neutral-500">с нами с {new Date(user.created_at).toLocaleDateString("ru-RU")}</div>
          </div>
        </div>
      </div>
      <h2 className="font-extrabold">Вопросы · {threads.length}</h2>
      {threadsFailed ? (
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          Не загрузилось — обновите страницу.
        </div>
      ) : (
        <>
          {threads.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
              Пока ничего не спрашивал(а)
            </div>
          )}
          <div className="space-y-3">{threads.map((t) => <ThreadCard key={t.id} t={t} />)}</div>
        </>
      )}
    </div>
  );
}
