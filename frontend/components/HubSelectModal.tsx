"use client";
/* eslint-disable react-hooks/set-state-in-effect -- дебаунс-поиск разделов */

import { useEffect, useState } from "react";
import { Globe2, MapPin, MapPinned, ChevronDown, Plus, Search, Users, X } from "lucide-react";
import { searchHubs, scopeParams, type HubListItem, type PickedHub } from "@/lib/v5";
import { useScope, scopeLabel } from "@/lib/scope";
import ScopePicker from "@/components/ScopePicker";

/** Модалка выбора раздела в духе Reddit "Choose community":
 * поиск, список разделов, пункт "Общие вопросы", кнопка создания. */
export default function HubSelectModal({ open, value, onClose, onPick, onCreateHub }: {
  open: boolean;
  value: PickedHub | null;
  onClose: () => void;
  onPick: (h: PickedHub | null) => void;
  onCreateHub: () => void;
}) {
  const { scope, setScope } = useScope();
  const [q, setQ] = useState("");
  const [hubs, setHubs] = useState<HubListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try { setHubs(await searchHubs(q, scopeParams(scope))); } catch { setHubs([]); }
      finally { setLoading(false); }
    }, q.trim().length >= 2 ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, scope]);

  // Esc закрывает
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const pick = (h: HubListItem) => {
    if (h.place) onPick({ id: h.id, title: h.title, placeId: h.place.id, placeName: h.place.name });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Выбор раздела"
    >
      <div
        className="flex max-h-[85svh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-neutral-800">
          <span className="flex-1 text-[17px] font-extrabold dark:text-neutral-100">Выбор раздела</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти раздел…"
              maxLength={100}
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-100 pl-9 pr-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-900"
            />
          </div>
          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setScopeOpen(!scopeOpen)}
              className="flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <MapPinned className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{scopeLabel(scope)}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-500" />
            </button>
            {scopeOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <ScopePicker value={scope} onChange={(s) => { setScope(s); setScopeOpen(false); }} />
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <button
            type="button"
            onClick={() => { onPick(null); onClose(); }}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-neutral-800 ${value === null ? "bg-emerald-50 dark:bg-emerald-950/60" : ""}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-neutral-700">
              <Globe2 className="h-5 w-5 text-slate-500 dark:text-neutral-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold dark:text-neutral-100">Общие вопросы</span>
              <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">Вопрос попадёт в общую ленту</span>
            </span>
            {value === null && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />}
          </button>

          {loading && <div className="py-3 text-center text-sm text-slate-400">Ищем…</div>}
          {!loading && hubs.length === 0 && q.trim().length >= 2 && (
            <div className="py-3 text-center text-sm text-slate-400 dark:text-neutral-500">Ничего не нашли</div>
          )}
          {hubs.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => pick(h)}
              disabled={!h.place}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-neutral-800 ${value?.id === h.id ? "bg-emerald-50 dark:bg-emerald-950/60" : ""}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {(h.title || "Р").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold dark:text-neutral-100">{h.title}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">
                  {h.members} вопр.{h.place ? ` · ${h.place.name}` : ""}
                </span>
              </span>
              {value?.id === h.id && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-100 p-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onCreateHub}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-neutral-700 dark:text-neutral-300"
          >
            <Plus className="h-4 w-4" /> Создать новый раздел
          </button>
        </div>

        <div className="px-4 pb-2 pt-1 text-xs text-slate-400 dark:text-neutral-500">
          <MapPin className="mr-1 inline h-3 w-3" />
          Нет подходящего? Создайте раздел своего двора, парка или улицы.
        </div>
      </div>
    </div>
  );
}

/** Компактная кнопка-селектор раздела для шапки формы. */
export function HubSelectButton({ value, onOpen }: {
  value: PickedHub | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3 text-left shadow-sm hover:bg-slate-50 sm:w-auto dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
    >
      {value ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {(value.title || "Р").slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <Users className="h-5 w-5 shrink-0 text-slate-400" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-bold sm:max-w-52 dark:text-neutral-100">
        {value ? value.title : "Общие вопросы"}
      </span>
      <span className="shrink-0 text-xs text-slate-400">▾</span>
    </button>
  );
}
