"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка разделов с сервера */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, MessageCircle, MessagesSquare, Pencil, Search } from "lucide-react";
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
  dateRu,
  errMessage,
  inputCls,
  textareaCls,
} from "./common";

interface Hub {
  id: number;
  title: string | null;
  author: string | null;
  city: string | null;
  district: string | null;
  region: string | null;
  is_archived: boolean;
  comments_count: number;
  created_at: string;
}

function regionOf(h: Hub): string {
  const parts = [h.district, h.city, h.region].filter(Boolean) as string[];
  return [...new Set(parts)].join(", ") || "—";
}

export default function HubsAdmin() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(true);

  const [renaming, setRenaming] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingBody, setEditingBody] = useState<number | null>(null);
  const [bodyDraft, setBodyDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/hubs");
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить разделы"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((h) => {
      if (!showArchived && h.is_archived) return false;
      if (!q) return true;
      return [h.title, h.author, h.city, h.district, h.region]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, showArchived]);

  const rename = async (h: Hub) => {
    const title = titleDraft.trim();
    if (title.length < 2) {
      toast("Название слишком короткое", "error");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/hubs/${h.id}`, { title });
      toast("Название обновлено", "success");
      setRenaming(null);
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось переименовать раздел"), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (h: Hub) => {
    const next = !h.is_archived;
    if (next && !(await confirm({
      title: `Переместить раздел «${h.title ?? "Без названия"}» в архив?`,
      text: "Раздел перестанет показываться в ленте, но останется доступен по ссылке.",
      ok: "В архив",
    }))) return;
    setBusy(true);
    try {
      await api.patch(`/admin/hubs/${h.id}`, { is_archived: next });
      toast(next ? "Раздел в архиве" : "Раздел снова активен", "success");
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось изменить статус раздела"), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveBody = async (h: Hub) => {
    const text = bodyDraft.trim();
    if (!text) {
      toast("Описание не может быть пустым", "error");
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/hubs/${h.id}`, { body_md: text });
      toast("Описание обновлено", "success");
      setEditingBody(null);
      load();
    } catch (e) {
      toast(errMessage(e, "Не получилось сохранить описание"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <MessagesSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Разделы
        </h2>
        <Counter count={filtered.length} label="найдено" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, автору, региону…"
            maxLength={60}
            className={`${inputCls} pl-9`}
          />
        </div>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={showArchived ? btnGhost : btnPrimary}
        >
          {showArchived ? "Скрыть архив" : "Показать архив"}
        </button>
      </div>

      {loading && <LoadingRows rows={3} />}
      {!loading && error && <ErrorBlock message={error} onRetry={load} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyBlock
          icon={<MessagesSquare className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title={items.length === 0 ? "Разделов пока нет" : "Ничего не найдено"}
          text={items.length === 0 ? "Разделы появятся здесь, когда жители создадут их." : "Попробуйте изменить запрос или показывать архивные разделы."}
        />
      )}

      <div className="space-y-2">
        {filtered.map((h) => (
          <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              {renaming === h.id ? (
                <div className="flex w-full flex-wrap items-center gap-1.5">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    maxLength={150}
                    autoFocus
                    className={`${inputCls} flex-1`}
                  />
                  <button onClick={() => rename(h)} disabled={busy} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                    Сохранить
                  </button>
                  <button onClick={() => setRenaming(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-neutral-700 dark:text-neutral-400">
                    Отмена
                  </button>
                </div>
              ) : (
                <>
                  <Link href={`/hub/${h.id}`} className="min-w-0 flex-1 truncate text-sm font-extrabold hover:underline dark:text-neutral-100">
                    {h.title ?? "Без названия"}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400">
                    <MessageCircle className="h-3.5 w-3.5" /> {h.comments_count}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    h.is_archived
                      ? "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}>
                    {h.is_archived ? "в архиве" : "активен"}
                  </span>
                </>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-neutral-400">
              <span>автор: {h.author ? `@${h.author}` : "—"}</span>
              <span>{regionOf(h)}</span>
              <span>создан {dateRu(h.created_at)}</span>
            </div>

            {editingBody === h.id && (
              <div className="mt-2.5">
                <textarea
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Новое описание раздела"
                  className={textareaCls}
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                  Новый текст полностью заменит описание раздела.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => saveBody(h)} disabled={busy} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                    Сохранить описание
                  </button>
                  <button onClick={() => setEditingBody(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-neutral-700 dark:text-neutral-400">
                    Отмена
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => { setRenaming(h.id); setTitleDraft(h.title ?? ""); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Pencil className="h-3.5 w-3.5" /> Переименовать
              </button>
              <button
                onClick={() => { setEditingBody(h.id); setBodyDraft(""); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Pencil className="h-3.5 w-3.5" /> Описание
              </button>
              <button
                onClick={() => toggleArchive(h)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {h.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {h.is_archived ? "Вернуть" : "В архив"}
              </button>
              <Link
                href={`/hub/${h.id}`}
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
              >
                Открыть
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
