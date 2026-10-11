"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LogOut, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getApiError } from "@/lib/errors";
import { useToast } from "@/lib/toast";

interface Props {
  initialMode?: "login" | "register";
  onSuccess?: () => void;
}

export default function AuthPanel({ initialMode = "login", onSuccess }: Props) {
  const { user, loading, login, register, logout } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pwScore = password.length >= 8 && /[a-zA-Zа-яА-ЯёЁ]/.test(password) && /\d/.test(password)
    ? 2 : password.length >= 6 ? 1 : 0;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(username, email, password);
        toast("Аккаунт создан, вы вошли", "success");
      } else {
        await login(email, password);
        toast("Вы вошли", "success");
      }
      setPassword("");
      onSuccess?.();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="py-4 text-center text-sm text-slate-400 dark:text-neutral-500">Проверяем сессию…</p>;

  if (user) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-neutral-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-300 text-lg font-extrabold text-slate-900">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold">@{user.username}</p>
            <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{user.email}</p>
          </div>
        </div>
        <p className="text-[13px] text-slate-500 dark:text-neutral-400">Вы вошли. Задайте вопрос городу или ответьте другим.</p>
        <Link href="/profile" className="text-[13px] font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          Перейти в профиль →
        </Link>
        <button
          onClick={() => { logout(); toast("Вы вышли", "info"); }}
          className="flex w-fit items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400"
        >
          <LogOut className="h-3.5 w-3.5" /> Выйти
        </button>
      </div>
    );
  }

  const input = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 text-sm">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-[13px] font-bold dark:bg-neutral-800">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m} type="button" onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-1.5 ${mode === m ? "bg-white shadow dark:bg-neutral-900" : "text-slate-500 dark:text-neutral-400"}`}
          >
            {m === "login" ? "Вход" : "Регистрация"}
          </button>
        ))}
      </div>

      {mode === "register" && (
        <input className={input} placeholder="Имя пользователя" value={username}
          onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={50} />
      )}
      <input className={input} placeholder="Email или ник" value={email}
        onChange={(e) => setEmail(e.target.value)} required />
      <div className="relative">
        <input className={`${input} pr-11`} placeholder="Пароль" type={showPw ? "text" : "password"}
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button type="button" onClick={() => setShowPw(!showPw)} aria-label="Показать пароль"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-neutral-500 dark:hover:bg-neutral-800">
          {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
        </button>
      </div>
      {mode === "register" && password.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <div className="flex flex-1 gap-1">
            {[0, 1].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${pwScore > i ? "bg-emerald-500" : "bg-slate-200 dark:bg-neutral-700"}`} />
            ))}
          </div>
          <span className="text-slate-400 dark:text-neutral-500">{pwScore === 2 ? "надежный" : "мин. 6 символов, лучше с цифрой"}</span>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950 dark:text-red-400">{error}</p>}

      <button disabled={busy}
        className="mt-1 h-11 rounded-xl bg-slate-900 text-[15px] font-bold text-white transition hover:bg-slate-700 disabled:opacity-50">
        {busy ? "Секунду…" : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
    </form>
  );
}
