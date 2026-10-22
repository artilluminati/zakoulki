"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка категорий с сервера */

import { useCallback, useEffect, useState } from "react";
import { FolderTree, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import {
  Counter,
  EmptyBlock,
  ErrorBlock,
  LoadingRows,
  btnGhost,
  btnPrimary,
  errMessage,
  inputCls,
  slugify,
} from "./common";

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  threads_count: number;
}

interface FormState {
  name: string;
  slug: string;
  icon: string;
}

const EMPTY_FORM: FormState = { name: "", slug: "", icon: "" };

export default function CategoriesAdmin() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/categories");
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить категории"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setAdding(true);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
  };

  const openEdit = (c: Category) => {
    setAdding(false);
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, icon: c.icon ?? "" });
    setSlugTouched(true);
  };

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
  };

  const submit = async () => {
    const name = form.name.trim();
    if (name.length < 2) {
      toast("Название слишком короткое", "error");
      return;
    }
    let slug = form.slug.trim();
    if (!slugTouched) slug = slugify(name);
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      toast("Адрес может содержать только латиницу, цифры и дефис", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, {
          name,
          slug: slug || undefined,
          icon: form.icon.trim() || undefined,
        });
        toast("Категория обновлена", "success");
      } else {
        await api.post("/admin/categories", {
          name,
          slug: slug || undefined,
          icon: form.icon.trim() || undefined,
        });
        toast("Категория добавлена", "success");
      }
      closeForm();
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось сохранить категорию"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Category) => {
    if (!(await confirm({
      title: `Удалить категорию «${c.name}»?`,
      text: c.threads_count
        ? `В категории ${c.threads_count} тред(ов) — удаление будет запрещено.`
        : "Категория исчезнет из списка.",
      ok: "Удалить",
      danger: true,
    }))) return;
    try {
      await api.delete(`/admin/categories/${c.id}`);
      toast("Категория удалена", "success");
      if (editing?.id === c.id) closeForm();
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось удалить категорию"), "error");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <FolderTree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Категории
        </h2>
        <Counter count={items.length} label="шт." />
        <button onClick={openAdd} className={`${btnPrimary} ml-auto`}>
          <Plus className="h-4 w-4" /> Добавить категорию
        </button>
      </div>

      {(adding || editing) && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold dark:text-neutral-100">
              {editing ? "Изменение категории" : "Новая категория"}
            </span>
            <button onClick={closeForm} aria-label="Закрыть форму" className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-neutral-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Название</span>
              <input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: slugTouched ? f.slug : slugify(name),
                  }));
                }}
                maxLength={60}
                placeholder="Например, ЖКХ"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Адрес (латиницей)</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
                maxLength={60}
                placeholder="zhkh"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-500 dark:text-neutral-400">Иконка</span>
              <input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                maxLength={40}
                placeholder="building"
                className={inputCls}
              />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-400">
            Адрес подставляется автоматически из названия — можно поправить вручную.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={saving} className={btnPrimary}>
              {saving ? "Сохраняем…" : editing ? "Сохранить" : "Добавить"}
            </button>
            <button onClick={closeForm} className={btnGhost}>Отмена</button>
          </div>
        </div>
      )}

      {loading && <LoadingRows rows={3} />}
      {!loading && error && <ErrorBlock message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && (
        <EmptyBlock
          icon={<Tag className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title="Категорий пока нет"
          text="Добавьте первую — её смогут выбирать жители в своих вопросах."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* мобильный вид — карточки */}
          <div className="space-y-2 sm:hidden">
            {items.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-extrabold dark:text-neutral-100">{c.name}</span>
                  <Counter count={c.threads_count} label="тредов" />
                </div>
                <div className="mt-1 truncate text-xs text-slate-400 dark:text-neutral-500">/{c.slug}</div>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => openEdit(c)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold dark:border-neutral-700 dark:text-neutral-300">
                    Изменить
                  </button>
                  <button onClick={() => remove(c)} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* десктоп — таблица */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white sm:block dark:border-neutral-700 dark:bg-neutral-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-bold">Название</th>
                  <th className="px-4 py-2 font-bold">Адрес</th>
                  <th className="px-4 py-2 font-bold">Иконка</th>
                  <th className="px-4 py-2 font-bold">Тредов</th>
                  <th className="px-4 py-2 text-right font-bold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 dark:border-neutral-800">
                    <td className="px-4 py-2.5 font-bold dark:text-neutral-100">{c.name}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-neutral-400">/{c.slug}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-neutral-400">{c.icon || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-neutral-400">{c.threads_count}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                          <Pencil className="h-3.5 w-3.5" /> Изменить
                        </button>
                        <button onClick={() => remove(c)} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500">
                          <Trash2 className="h-3.5 w-3.5" /> Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
