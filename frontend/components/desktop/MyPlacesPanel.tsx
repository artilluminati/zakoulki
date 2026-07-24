"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getApiError } from "@/lib/errors";
import type { Category, Place } from "@/types";

interface Props {
  places: Place[];
  categories: Category[];
  onRequestLogin: () => void;
  onUpdated: (place: Place) => void;
  onDeleted: (placeId: number) => void;
}

export default function MyPlacesPanel({ places, categories, onRequestLogin, onUpdated, onDeleted }: Props) {
  const { user, loading: authLoading } = useAuth();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return <p className="text-xs opacity-60">Проверяем сессию…</p>;
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-start gap-3 text-sm">
        <p className="opacity-70">Войдите, чтобы увидеть и отредактировать свои места.</p>
        <button
          onClick={onRequestLogin}
          className="border border-[#0b3d91] bg-[#0b3d91] px-3 py-1 text-white"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const myPlaces = places.filter((p) => p.created_by === user.id);

  const startEdit = (place: Place) => {
    setError(null);
    setConfirmDeleteId(null);
    setEditingId(place.id);
    setEditTitle(place.title);
    setEditCategoryIds(place.categories.map((c) => c.id));
  };

  const cancelEdit = () => setEditingId(null);

  const toggleEditCategory = (id: number) => {
    setEditCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const saveEdit = async (place: Place) => {
    if (!editTitle.trim()) {
      setError("Название не может быть пустым");
      return;
    }
    setBusyId(place.id);
    setError(null);
    try {
      const res = await api.patch(`/places/${place.id}`, {
        title: editTitle,
        category_ids: editCategoryIds,
      });
      onUpdated(res.data);
      setEditingId(null);
    } catch (err) {
      setError(getApiError(err, "Не удалось сохранить изменения"));
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (placeId: number) => {
    setBusyId(placeId);
    setError(null);
    try {
      await api.delete(`/places/${placeId}`);
      onDeleted(placeId);
    } catch (err) {
      setError(getApiError(err, "Не удалось удалить место"));
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 text-sm">
      <p className="text-xs opacity-70">Места, которые добавили вы. Можно переименовать, поменять категории или удалить.</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex-1 space-y-2 overflow-auto pr-1">
        {myPlaces.length === 0 && (
          <p className="text-xs opacity-50">
            Пока пусто — отметьте первое место через окно «Добавить место».
          </p>
        )}

        {myPlaces.map((place) => {
          const isEditing = editingId === place.id;
          const isBusy = busyId === place.id;
          const isConfirmingDelete = confirmDeleteId === place.id;

          if (isEditing) {
            return (
              <div key={place.id} className="space-y-1 rounded border border-[#0b3d91]/30 bg-white p-2">
                <input
                  className="w-full border border-[#0b3d91]/40 px-2 py-1 text-sm"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={isBusy}
                />
                <div className="max-h-24 space-y-1 overflow-auto border border-[#0b3d91]/10 p-1">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={editCategoryIds.includes(cat.id)}
                        onChange={() => toggleEditCategory(cat.id)}
                        disabled={isBusy}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(place)}
                    disabled={isBusy}
                    className="flex-1 border border-[#0b3d91] bg-[#0b3d91] px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    {isBusy ? "Сохраняем…" : "Сохранить"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isBusy}
                    className="flex-1 border border-[#0b3d91]/30 bg-white px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={place.id} className="rounded border border-[#0b3d91]/20 bg-white p-2">
              <p className="truncate text-sm font-bold">{place.title}</p>
              {place.categories.length > 0 && (
                <p className="truncate text-xs opacity-60">
                  {place.categories.map((c) => c.name).join(", ")}
                </p>
              )}

              {isConfirmingDelete ? (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="opacity-70">Точно удалить?</span>
                  <button
                    onClick={() => doDelete(place.id)}
                    disabled={isBusy}
                    className="border border-red-600 bg-red-600 px-2 py-0.5 text-white disabled:opacity-50"
                  >
                    {isBusy ? "Удаляем…" : "Да, удалить"}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={isBusy}
                    className="border border-[#0b3d91]/30 bg-white px-2 py-0.5 disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    onClick={() => startEdit(place)}
                    className="border border-[#0b3d91] bg-white px-2 py-0.5 hover:bg-[#e7f0ff]"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(place.id)}
                    className="border border-red-500 bg-white px-2 py-0.5 text-red-600 hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
