"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getApiError } from "@/lib/errors";

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setMessage(null);
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== repeat) {
      setError("Пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setMessage(res.data?.message ?? "Пароль обновлён — можно войти");
    } catch (err) {
      setError(getApiError(err, "Не получилось сменить пароль — запросите ссылку ещё раз"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <Link href="/" className="mb-4 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-lg font-extrabold">З</span>
          <span className="text-lg font-extrabold">Закоулки</span>
        </Link>
        <h1 className="text-center text-xl font-extrabold">Новый пароль</h1>

        {!token ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <KeyRound className="mx-auto mb-2 h-6 w-6" />
            Ссылка для смены пароля не найдена. Запросите новую — мы отправим письмо на вашу почту.
          </div>
        ) : done ? (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <KeyRound className="mx-auto mb-2 h-6 w-6" />
            {message}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 text-sm">
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Новый пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Повторите пароль"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950 dark:text-red-400">{error}</p>
            )}
            <button
              disabled={busy}
              className="h-11 rounded-xl bg-slate-900 text-[15px] font-bold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? "Секунду…" : "Сохранить пароль"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-[13px] text-slate-500 dark:text-neutral-400">
          {done ? (
            <Link href="/login" className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-300">
              Войти в аккаунт <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
            </Link>
          ) : (
            <Link href="/login" className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-300">
              <ArrowLeft className="h-3.5 w-3.5" /> Вернуться ко входу
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}
