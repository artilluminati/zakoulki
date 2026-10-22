"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import BadgesAdmin, { type UserBadge } from "./BadgesAdmin";
import {
  Counter,
  EmptyBlock,
  ErrorBlock,
  LoadingRows,
  btnGhost,
  errMessage,
  inputCls,
} from "./common";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  badge?: string | null;
  badges: UserBadge[];
  email_notifications?: boolean;
  created_at: string;
}

export default function UsersAdmin() {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm, prompt } = useConfirm();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const loadedRef = useRef(false);

  const load = useCallback(async (q: string) => {
    // скелетон только при первой загрузке — дальше список обновляется тихо
    if (!loadedRef.current) setLoading(true);
    try {
      const res = await api.get("/admin/users", { params: q.trim() ? { q: q.trim() } : {} });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить пользователей"));
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
  }, [load, query]);

  const changeRole = async (u: AdminUser) => {
    if (user && u.id === user.id && u.role === "admin") {
      toast("Нельзя снять админа с себя", "error");
      return;
    }
    if (!(await confirm({
      title: `${u.role === "admin" ? "Снять админа" : "Сделать админом"} @${u.username}?`,
      danger: u.role !== "admin",
    }))) return;
    try {
      await api.patch(`/admin/users/${u.id}`, { role: u.role === "admin" ? "user" : "admin" });
      toast("Роль обновлена", "success");
      load(query);
    } catch (e) {
      toast(errMessage(e, "Не получилось изменить роль"), "error");
    }
  };

  const resetPassword = async (u: AdminUser) => {
    const pw = await prompt({
      title: `Новый пароль для @${u.username}`,
      text: "Минимум 6 символов. Передайте его пользователю.",
      input: { placeholder: "Новый пароль" },
      ok: "Сбросить",
    });
    if (!pw) return;
    if (pw.length < 6) {
      toast("Пароль короче 6 символов", "error");
      return;
    }
    try {
      await api.patch(`/admin/users/${u.id}/password`, { password: pw });
      toast(`Пароль @${u.username} обновлён — передайте его пользователю`, "success");
    } catch (e) {
      toast(errMessage(e, "Не получилось сбросить пароль"), "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Пользователи
        </h2>
        <Counter count={items.length} label="найдено" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по нику или почте…"
          maxLength={50}
          className={`${inputCls} pl-9`}
        />
      </div>

      {loading && <LoadingRows rows={4} />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => load(query)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyBlock
          icon={<Users className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title="Никого не нашли"
          text="Попробуйте изменить запрос или очистить поиск."
        />
      )}

      <div className="space-y-2">
        {items.map((u) => (
          <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/user/${u.username}`} className="truncate text-sm font-extrabold hover:underline dark:text-neutral-100">
                @{u.username}
              </Link>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                u.role === "admin"
                  ? "bg-slate-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
              }`}>
                {u.role === "admin" ? "админ" : "житель"}
              </span>
              <span className="truncate text-xs text-slate-400 dark:text-neutral-500">{u.email}</span>
            </div>

            <div className="mt-2">
              <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Бейджи</span>
              <BadgesAdmin
                userId={u.id}
                username={u.username}
                badges={u.badges ?? []}
                onChanged={() => load(query)}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button onClick={() => changeRole(u)} className={btnGhost}>
                {u.role === "admin" ? "снять админа" : "сделать админом"}
              </button>
              <button onClick={() => resetPassword(u)} className={btnGhost}>
                сбросить пароль
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
