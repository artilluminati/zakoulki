"use client";

import { useState } from "react";
import { X, Plus, BarChart3 } from "lucide-react";

export interface PollDraft { question: string; options: string[]; multiple: boolean; }

/** Конструктор опроса отдельным блоком (как в ТГ). До 10 вариантов, минимум 2. */
export default function PollBuilder({ value, onChange }: {
  value: PollDraft | null;
  onChange: (v: PollDraft | null) => void;
}) {
  const [open, setOpen] = useState(value !== null);

  if (!open && !value) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); onChange({ question: "", options: ["", ""], multiple: false }); }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-3 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:bg-neutral-900 dark:text-neutral-400"
      >
        <BarChart3 className="h-5 w-5" /> Добавить опрос
      </button>
    );
  }

  const v: PollDraft = value ?? { question: "", options: ["", ""], multiple: false };
  const set = (p: Partial<PollDraft>) => onChange({ ...v, ...p });
  const setOpt = (i: number, text: string) => {
    const options = [...v.options];
    options[i] = text;
    set({ options });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-bold"><BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Опрос</span>
        <button
          type="button"
          onClick={() => { setOpen(false); onChange(null); }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 dark:text-neutral-500"
        >
          <X className="h-4 w-4" /> убрать
        </button>
      </div>
      <input
        value={v.question}
        onChange={(e) => set({ question: e.target.value })}
        maxLength={300}
        placeholder="Вопрос опроса"
        className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800"
      />
      <div className="mt-2 space-y-1.5">
        {v.options.map((o, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={o}
              onChange={(e) => setOpt(i, e.target.value)}
              maxLength={150}
              placeholder={`Вариант ${i + 1}`}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800"
            />
            {v.options.length > 2 && (
              <button
                type="button"
                onClick={() => set({ options: v.options.filter((_, j) => j !== i) })}
                aria-label="Убрать вариант"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 dark:border-neutral-700 dark:text-neutral-500"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {v.options.length < 10 ? (
          <button
            type="button"
            onClick={() => set({ options: [...v.options, ""] })}
            className="flex items-center gap-1 text-[13px] font-bold text-emerald-700 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" /> Вариант
          </button>
        ) : <span />}
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-slate-500 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={v.multiple}
            onChange={(e) => set({ multiple: e.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          Несколько вариантов
        </label>
      </div>
    </div>
  );
}
