"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { City, Category, Place } from "@/types";

interface Props {
  city: City;
  categories: Category[];
  pickMode: boolean;
  pickedPoint: { lat: number; lng: number } | null;
  onTogglePick: () => void;
  onCreated: (place: Place) => void;
  onRequestLogin: () => void;
}

export default function AddPlacePanel({
  city,
  categories,
  pickMode,
  pickedPoint,
  onTogglePick,
  onCreated,
  onRequestLogin,
}: Props) {
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

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
      setJustCreated(res.data.title as string);
      setTitle("");
      setCategoryIds([]);
      setTimeout(() => setJustCreated(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Не удалось создать место");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <p className="text-xs opacity-60">Проверяем сессию…</p>;
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-start gap-3 text-sm">
        <p className="opacity-70">
          Чтобы отмечать новые места на карте, нужно войти в аккаунт или
          зарегистрироваться.
        </p>
        <button
          onClick={onRequestLogin}
          className="border border-[#0b3d91] bg-[#0b3d91] px-3 py-1 text-white"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
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
      {justCreated && (
        <p className="text-xs text-green-700">«{justCreated}» добавлено на карту ✓</p>
      )}

      <button
        disabled={submitting}
        className="border border-[#0b3d91] bg-[#0b3d91] px-2 py-1 text-white disabled:opacity-50"
      >
        {submitting ? "Публикуем…" : "Создать место"}
      </button>
    </form>
  );
}
