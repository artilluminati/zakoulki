"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { City, Category, Place } from "@/types";

interface Props {
  city: City;
  categories: Category[];
  pickMode: boolean;
  pickedPoint: { lat: number; lng: number } | null;
  onTogglePick: () => void;
  onCreated: (place: Place) => void;
}

export default function AddPlacePanel({
  city,
  categories,
  pickMode,
  pickedPoint,
  onTogglePick,
  onCreated,
}: Props) {
  const [hasToken, setHasToken] = useState(
    typeof window !== "undefined" && !!localStorage.getItem("token")
  );

  // --- лёгкая авторизация прямо в окне (полноценные /login и /register — следующий шаг) ---
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === "register") {
        await api.post("/auth/register", { username, email, password });
      }
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.access_token);
      setHasToken(true);
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail || "Не удалось войти. Проверьте данные.");
    } finally {
      setAuthBusy(false);
    }
  };

  // --- форма создания места ---
  const [title, setTitle] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: number) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pickedPoint) {
      setError("Сначала выберите точку на карте");
      return;
    }
    if (!title.trim()) {
      setError("Введите название места");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/places", {
        city_id: city.id,
        title,
        latitude: pickedPoint.lat,
        longitude: pickedPoint.lng,
        category_ids: categoryIds,
      });
      onCreated(res.data);
      setTitle("");
      setCategoryIds([]);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Не удалось создать место");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasToken) {
    return (
      <form onSubmit={handleAuth} className="flex h-full flex-col gap-2 text-sm">
        <p className="text-xs opacity-70">Чтобы добавлять места, войдите или зарегистрируйтесь.</p>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setAuthMode("login")}
            className={`flex-1 border px-2 py-1 ${
              authMode === "login" ? "border-[#0b3d91] bg-[#e7f0ff]" : "border-[#0b3d91]/30 bg-white"
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("register")}
            className={`flex-1 border px-2 py-1 ${
              authMode === "register" ? "border-[#0b3d91] bg-[#e7f0ff]" : "border-[#0b3d91]/30 bg-white"
            }`}
          >
            Регистрация
          </button>
        </div>

        {authMode === "register" && (
          <input
            className="border border-[#0b3d91]/40 px-2 py-1"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <input
          className="border border-[#0b3d91]/40 px-2 py-1"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border border-[#0b3d91]/40 px-2 py-1"
          placeholder="Пароль"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {authError && <p className="text-xs text-red-600">{authError}</p>}

        <button
          disabled={authBusy}
          className="mt-auto border border-[#0b3d91] bg-[#0b3d91] px-2 py-1 text-white disabled:opacity-50"
        >
          {authBusy ? "Секунду…" : authMode === "login" ? "Войти" : "Создать аккаунт и войти"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-2 text-sm">
      <button
        type="button"
        onClick={onTogglePick}
        className={`border px-2 py-1 text-xs ${
          pickMode ? "border-red-600 bg-red-100" : "border-[#0b3d91] bg-white"
        }`}
      >
        {pickMode ? "Отменить выбор точки" : "Выбрать точку на карте"}
      </button>

      <p className="text-xs opacity-70">
        {pickedPoint
          ? `Координаты: ${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`
          : "Точка ещё не выбрана"}
      </p>

      <input
        className="border border-[#0b3d91]/40 px-2 py-1"
        placeholder="Название места"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex-1 space-y-1 overflow-auto">
        {categories.map((cat) => (
          <label key={cat.id} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={categoryIds.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />
            {cat.name}
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        disabled={submitting}
        className="border border-[#0b3d91] bg-[#0b3d91] px-2 py-1 text-white disabled:opacity-50"
      >
        {submitting ? "Публикуем…" : "Создать место"}
      </button>
    </form>
  );
}
