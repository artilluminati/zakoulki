"use client";
/* eslint-disable react-hooks/set-state-in-effect -- чтение домашнего города и дебаунс-подсказки */

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { fetchThreads, fetchBookmarks } from "@/lib/v5";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/lib/theme";
import { getHomeCity, setHomeCity } from "@/lib/scope";
import ThreadCard, { timeAgo, OfficialBadge } from "@/components/ThreadCard";
import type { ThreadV5 } from "@/types/v5";

interface Notif { id: string | number; kind: string; author?: string; author_id?: number; thread_id?: number | null; comment_id?: number | null; title?: string | null; snippet?: string; created_at?: string; }

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const [mine, setMine] = useState<ThreadV5[]>([]);
  const [mineFailed, setMineFailed] = useState(false);
  const [mineHasMore, setMineHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [saved, setSaved] = useState<ThreadV5[]>([]);
  const [tab, setTab] = useState<"mine" | "saved">("mine");
  // домашний город: подсказки региона и стартовый скоуп
  const [home, setHome] = useState<string | null>(null);
  const [homeQ, setHomeQ] = useState("");
  const [homeFound, setHomeFound] = useState<{ name: string }[]>([]);
  const [homeHi, setHomeHi] = useState(0);
  useEffect(() => {
    setHome(getHomeCity());
  }, []);
  useEffect(() => {
    if (homeQ.trim().length < 2) { setHomeFound([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/geo-places/suggest", { params: { level: "city", q: homeQ.trim(), limit: 5 } });
        setHomeFound(r.data ?? []);
      } catch { setHomeFound([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [homeQ]);

  useEffect(() => {
    if (user) {
      fetchThreads({ author_id: user.id, limit: 20 }).then((d) => { setMine(d); setMineHasMore(d.length === 20); }).catch(() => setMineFailed(true));
      api.get("/threads/notifications/mine").then((r) => setNotifs(r.data ?? [])).catch(() => { /* ignore */ });
      fetchBookmarks().then(setSaved).catch(() => { /* ignore */ });
    }
  }, [user]);

  const loadMoreMine = async () => {
    if (!user || loadingMore || !mine.length) return;
    setLoadingMore(true);
    try {
      const d = await fetchThreads({ author_id: user.id, limit: 20, before_id: mine[mine.length - 1].id });
      setMine((prev) => [...prev, ...d]);
      setMineHasMore(d.length === 20);
    } catch { /* тихо: старые уже на экране */ }
    finally { setLoadingMore(false); }
  };

  const logoutSafe = () => {
    if (!window.confirm("Выйти из аккаунта?")) return;
    logout();
  };

  if (loading) return <div className="mx-auto max-w-2xl px-3 pt-10">Загружаем…</div>;
  if (!user) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Войдите. <Link href="/login" className="underline">Войти</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime-200 text-2xl font-extrabold text-slate-900">{user.username.slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
              <span>@{user.username}</span>
              {user.badge === "official" && <OfficialBadge />}
            </div>
            <div className="text-sm text-slate-500 dark:text-neutral-400">{user.email}</div>
            <div className="text-xs text-slate-400 dark:text-neutral-500">с нами с {new Date(user.created_at).toLocaleDateString("ru-RU")}</div>
          </div>
          <button onClick={logoutSafe} className="ml-auto rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-neutral-700">Выйти</button>
          <ThemeToggle />
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <span><b>{mine.length}</b> <span className="text-slate-500 dark:text-neutral-400">вопросов</span></span>
          {user.role === "admin" && <Link href="/admin" className="font-bold text-emerald-700 dark:text-emerald-300">Админка →</Link>}
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-sm font-extrabold dark:text-neutral-100">
          Домашний город
          {home && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[13px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{home}</span>
          )}
          {home && (
            <button
              onClick={() => { setHomeCity(null); setHome(null); }}
              className="ml-auto text-[13px] font-semibold text-slate-400 hover:text-red-500"
            >
              Убрать
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">Подсказывается первым в выборе региона и становится стартовым.</p>
        <div className="relative mt-2">
          <input
            value={homeQ}
            onChange={(e) => { setHomeQ(e.target.value); setHomeHi(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && homeFound.length > 0) {
                e.preventDefault();
                setHomeHi((h) => Math.min(h + 1, homeFound.length - 1));
              } else if (e.key === "ArrowUp" && homeFound.length > 0) {
                e.preventDefault();
                setHomeHi((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const c = homeFound[homeHi];
                if (c) {
                  setHomeCity(c.name); setHome(c.name); setHomeQ(""); setHomeFound([]); setHomeHi(0);
                }
              } else if (e.key === "Escape") {
                setHomeFound([]);
              }
            }}
            placeholder="Найти город…"
            maxLength={100}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          {homeFound.length > 0 && (
            <div className="absolute inset-x-0 top-11 z-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              {homeFound.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  onMouseEnter={() => setHomeHi(i)}
                  onClick={() => { setHomeCity(c.name); setHome(c.name); setHomeQ(""); setHomeFound([]); setHomeHi(0); }}
                  className={`block w-full truncate px-3 py-2 text-left text-sm font-semibold dark:text-neutral-200 ${i === homeHi ? "bg-emerald-50 dark:bg-emerald-950" : "hover:bg-slate-50 dark:hover:bg-neutral-800"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        {(["mine", "saved"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${tab === tb ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"}`}
          >
            {tb === "mine" ? `Мои вопросы · ${mine.length}` : `Закладки · ${saved.length}`}
          </button>
        ))}
      </div>
      {mineFailed ? (
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          Не загрузилось — обновите страницу.
        </div>
      ) : tab === "mine" ? (
        <div className="space-y-3">
          {mine.map((t) => <ThreadCard key={t.id} t={t} />)}
          {mine.length === 0 && <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 dark:bg-neutral-900 dark:text-neutral-500">Пока пусто. <Link href="/create" className="font-bold text-emerald-700 dark:text-emerald-300">Спросить →</Link></div>}
          {mineHasMore && mine.length > 0 && (
            <button onClick={loadMoreMine} disabled={loadingMore} className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800">
              {loadingMore ? "Загружаем…" : "Показать ещё"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {saved.map((t) => <ThreadCard key={t.id} t={t} />)}
          {saved.length === 0 && <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 dark:bg-neutral-900 dark:text-neutral-500">Нет закладок — нажмите на флажок в карточке вопроса.</div>}
        </div>
      )}

      {notifs.length > 0 && (
        <>
          <h2 className="font-extrabold">Уведомления</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            {notifs.map((n) => (
              <Link
                key={String(n.id)}
                href={n.thread_id ? `/thread/${n.thread_id}${n.comment_id ? `#comment-${n.comment_id}` : ""}` : "/"}
                className="block border-b border-slate-50 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <span className="font-bold">{n.author ?? "Кто-то"}</span>
                <span className="text-slate-500 dark:text-neutral-400"> {n.kind === "mention" ? "упомянул(а) вас" : "ответил(а) в вашем треде"}</span>
                {n.snippet && <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-neutral-500">{n.snippet}</span>}
                {n.created_at && <span className="mt-0.5 block text-[11px] text-slate-300 dark:text-neutral-500">{timeAgo(n.created_at)}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
