"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getApiError } from "@/lib/errors";
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

type Stage = "idle" | "place" | "post" | "photos";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "Создать место",
  place: "Создаём место…",
  post: "Публикуем описание…",
  photos: "Загружаем фото…",
};

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

  // --- место ---
  const [title, setTitle] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  // --- первая публикация (обязательна вместе минимум с одной фотографией) ---
  const [postText, setPostText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const submitting = stage !== "idle";

  const toggleCategory = (id: number) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTitle("");
    setCategoryIds([]);
    setPostText("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!pickedPoint) {
      setError("Сначала выберите точку на карте");
      return;
    }
    if (!title.trim()) {
      setError("Введите название места");
      return;
    }
    if (!postText.trim()) {
      setError("Опишите находку в первой публикации");
      return;
    }
    if (files.length === 0) {
      setError("Добавьте хотя бы одну фотографию — она обязательна для первой публикации");
      return;
    }

    try {
      setStage("place");
      const placeRes = await api.post("/places", {
        city_id: city.id,
        title,
        latitude: pickedPoint.lat,
        longitude: pickedPoint.lng,
        category_ids: categoryIds,
      });
      const place: Place = placeRes.data;

      setStage("post");
      const postRes = await api.post("/posts", {
        place_id: place.id,
        title,
        text: postText,
      });
      const post = postRes.data;

      setStage("photos");
      for (const file of files) {
        const formData = new FormData();
        formData.append("post_id", String(post.id));
        formData.append("file", file);
        await api.post("/photos", formData);
      }

      // Место было создано до загрузки фото, поэтому у него ещё не было
      // cover_photo — перезапрашиваем, чтобы на карте сразу показалось превью.
      const refreshedPlace = await api.get(`/places/${place.id}`);

      onCreated(refreshedPlace.data);
      setJustCreated(place.title);
      resetForm();
      setTimeout(() => setJustCreated(null), 5000);
    } catch (err) {
      setError(getApiError(err, "Не удалось создать место"));
    } finally {
      setStage("idle");
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
        disabled={submitting}
        className={`border px-2 py-1 text-xs ${
          pickMode ? "border-red-600 bg-red-100" : "border-[#0b3d91] bg-white"
        } disabled:opacity-50`}
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
        disabled={submitting}
      />

      <div className="max-h-24 space-y-1 overflow-auto border border-[#0b3d91]/10 bg-white/60 p-1">
        {categories.map((cat) => (
          <label key={cat.id} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={categoryIds.includes(cat.id)}
              onChange={() => toggleCategory(cat.id)}
              disabled={submitting}
            />
            {cat.name}
          </label>
        ))}
      </div>

      <hr className="border-[#0b3d91]/20" />
      <p className="text-xs font-bold opacity-70">Первая публикация</p>

      <textarea
        className="border border-[#0b3d91]/40 px-2 py-1"
        placeholder="Расскажите, чем интересно это место"
        rows={3}
        value={postText}
        onChange={(e) => setPostText(e.target.value)}
        disabled={submitting}
      />

      <div className="space-y-1">
        <label
          className={`block cursor-pointer border px-2 py-1 text-center text-xs ${
            submitting ? "border-[#0b3d91]/30 opacity-50" : "border-[#0b3d91] bg-white hover:bg-[#e7f0ff]"
          }`}
        >
          📷 {files.length > 0 ? `Выбрано фото: ${files.length}` : "Выбрать фото (обязательно)"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            disabled={submitting}
            className="hidden"
          />
        </label>

        {files.length > 0 && (
          <ul className="max-h-16 space-y-0.5 overflow-auto text-xs">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 truncate">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={submitting}
                  className="shrink-0 text-red-600 hover:underline disabled:opacity-50"
                >
                  убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {justCreated && (
        <p className="text-xs text-green-700">«{justCreated}» опубликовано на карте ✓</p>
      )}

      <button
        disabled={submitting}
        className="mt-auto border border-[#0b3d91] bg-[#0b3d91] px-2 py-1 text-white disabled:opacity-50"
      >
        {STAGE_LABEL[stage]}
      </button>
    </form>
  );
}
