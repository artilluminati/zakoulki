"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";

export default function AuthPanel() {
    const { user, loading, login, register, logout } = useAuth();

    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    function getApiError(err: any): string {
        const detail = err?.response?.data?.detail;

        if (!detail) return "Неизвестная ошибка";

        if (typeof detail === "string") return detail;

        if (Array.isArray(detail)) return detail.map((e) => e.msg).join(", ");

        if (typeof detail === "object" && "msg" in detail) return detail.msg;

        return "Неизвестная ошибка";
    }

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (mode === "register") {
                await register(username, email, password);
            } else {
                await login(email, password);
            }
            setPassword("");
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
                        <p className="truncate text-xs opacity-60">
                            {user.email}
                        </p>
                    </div>
                </div>

                <p className="text-xs opacity-60">
                    Вы вошли в «Закоулки». Откройте окно «Добавить место», чтобы
                    отметить новую находку на карте.
                </p>

                <button
                    onClick={logout}
                    className="mt-auto self-start border border-red-500 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                    Выйти
                </button>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex h-full flex-col gap-2 text-sm"
        >
            <div className="flex gap-2 text-xs">
                <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`flex-1 border px-2 py-1 ${
                        mode === "login"
                            ? "border-[#0b3d91] bg-[#e7f0ff]"
                            : "border-[#0b3d91]/30 bg-white"
                    }`}
                >
                    Вход
                </button>
                <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={`flex-1 border px-2 py-1 ${
                        mode === "register"
                            ? "border-[#0b3d91] bg-[#e7f0ff]"
                            : "border-[#0b3d91]/30 bg-white"
                    }`}
                >
                    Регистрация
                </button>
            </div>

            {mode === "register" && (
                <input
                    className="border border-[#0b3d91]/40 px-2 py-1"
                    placeholder="Имя пользователя"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
            )}
            <input
                className="border border-[#0b3d91]/40 px-2 py-1"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <input
                className="border border-[#0b3d91]/40 px-2 py-1"
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
                className="mt-auto border border-[#0b3d91] bg-[#0b3d91] px-2 py-1 text-white disabled:opacity-50"
            >
                {busy
                    ? "Секунду…"
                    : mode === "login"
                      ? "Войти"
                      : "Создать аккаунт"}
            </button>
        </form>
    );
}
