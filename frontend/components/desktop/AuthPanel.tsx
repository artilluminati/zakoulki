"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { LogOut, UserCircle2 } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(username, email, password);
        toast("Аккаунт создан, вы вошли в систему", "success");
      } else {
        await login(email, password);
        toast("Вы вошли в систему", "success");
      }
      setPassword("");
      onSuccess?.();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-xs opacity-60">Проверяем сессию…</p>;
  }

  if (user) {
    return (
      <div className="flex h-full flex-col gap-3 text-sm">
        <div className="flex items-center gap-3 rounded border border-[#0b3d91]/20 bg-white p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b3d91] text-lg font-bold text-white">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold">{user.username}</p>
            <p className="truncate text-xs opacity-60">{user.email}</p>
          </div>
        </div>

        <p className="text-xs opacity-60">
          Вы вошли в «Закоулки». Откройте окно «Добавить место», чтобы отметить
          новую находку на карте.
        </p>

        <Link
          href="/profile"
          className="flex items-center gap-1.5 text-xs text-[#0b3d91] hover:underline"
        >
          <UserCircle2 className="h-3.5 w-3.5" />
          Перейти в профиль
        </Link>

        <button
          onClick={() => {
            logout();
            toast("Вы вышли из аккаунта", "info");
          }}
          className="mt-auto flex w-fit items-center gap-1.5 border border-red-500 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Выйти
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-2 text-sm">
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded border px-2 py-1 ${
            mode === "login" ? "border-[#0b3d91] bg-[#e7f0ff]" : "border-[#0b3d91]/30 bg-white"
          }`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded border px-2 py-1 ${
            mode === "register" ? "border-[#0b3d91] bg-[#e7f0ff]" : "border-[#0b3d91]/30 bg-white"
          }`}
        >
          Регистрация
        </button>
      </div>

      {mode === "register" && (
        <input
          className="rounded border border-[#0b3d91]/40 px-2 py-1.5 outline-none focus:border-[#0b3d91]"
          placeholder="Имя пользователя"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      )}
      <input
        className="rounded border border-[#0b3d91]/40 px-2 py-1.5 outline-none focus:border-[#0b3d91]"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="rounded border border-[#0b3d91]/40 px-2 py-1.5 outline-none focus:border-[#0b3d91]"
        placeholder="Пароль"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        disabled={busy}
        className="mt-auto rounded border border-[#0b3d91] bg-[#0b3d91] px-2 py-1.5 text-white transition hover:bg-[#0a3480] disabled:opacity-50"
      >
        {busy ? "Секунду…" : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
    </form>
  );
}
