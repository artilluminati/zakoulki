"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка тегов с сервера */

import { useCallback, useEffect, useState } from "react";
import { Hash, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { Counter, EmptyBlock, ErrorBlock, LoadingRows, btnGhost, btnPrimary, errMessage, inputCls } from "./common";

interface Tag {
  id: number;
  name: string;
  slug: string;
  count: number;
  threads_count: number;
}

export default function TagsAdmin() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Tag | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/tags", { params: query.trim() ? { q: query.trim() } : {} });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить теги"));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
    setForm("");
  };

  const openAdd = () => {
    setEditing(null);
    setAdding(true);
    setForm("");
  };

  const openEdit = (t: Tag) => {
    setAdding(false);
    setEditing(t);
    setForm(t.name);
  };

  const submit = async () => {
    const name = form.trim();
    if (!name) {
      toast("Имя тега не может быть пустым", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/tags/${editing.id}`, { name });
        toast("Тег переименован", "success");
      } else {
        toast("Теги создаются автоматически при публикации", "info");
        closeForm();
        setSaving(false);
        return;
      }
      closeForm();
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось сохранить тег"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Tag) => {
    const ok = await confirm({
      title: "Удалить тег?",
      message: `Тег «${t.name}» будет удалён из ${t.threads_count} тредов. Отменить нельзя.`,
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/tags/${t.id}`);
      toast("Тег удалён", "success");
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось удалить тег"), "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по тегам…"
          className={inputCls}
        />
        <button type="button" onClick={openAdd} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Добавить
        </button>
        <Counter n={items.length} />
      </div>

      {adding && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="text-[13px] text-slate-500 dark:text-neutral-400">
            Теги создаются автоматически при публикации постов (через # в тексте).
            Здесь можно переименовать или удалить существующий.
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={closeForm} className={btnGhost}>Закрыть</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={form}
              onChange={(e) => setForm(e.target.value)}
              placeholder="Имя тега"
              className={inputCls}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={submit} disabled={saving} className={btnPrimary}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button type="button" onClick={closeForm} className={btnGhost}>Отмена</button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorBlock text={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyBlock text="Тегов пока нет" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-neutral-700">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Тег</th>
                <th className="px-3 py-2 font-semibold">Упоминаний</th>
                <th className="px-3 py-2 font-semibold">В тредах</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 dark:border-neutral-800">
                  <td className="px-3 py-2 font-bold text-slate-700 dark:text-neutral-200">#{t.name}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">{t.count}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-neutral-400">{t.threads_count}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="text-xs font-bold text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300"
                      >
                        Переименовать
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(t)}
                        className="text-xs font-bold text-red-500 hover:text-red-700"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </table>
        </div>
      )}
    </div>
  );
}
TSX
echo "TagsAdmin created"