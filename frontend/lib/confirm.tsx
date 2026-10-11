"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ConfirmOpts {
  title: string;
  text?: string;
  ok?: string;
  cancel?: string;
  danger?: boolean;
  input?: { placeholder?: string; initial?: string };
}

interface Pending extends ConfirmOpts {
  resolve: (v: string | boolean | null) => void;
}

const Ctx = createContext<{
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: ConfirmOpts & { input?: { placeholder?: string; initial?: string } }) => Promise<string | null>;
} | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const idRef = useRef(0);

  const ask = useCallback((opts: ConfirmOpts): Promise<string | boolean | null> => {
    return new Promise((resolve) => {
      idRef.current += 1;
      setValue(opts.input?.initial ?? "");
      setPending({ ...opts, resolve: resolve as (v: string | boolean | null) => void });
    });
  }, []);

  const confirm = useCallback((o: ConfirmOpts) => ask(o).then((v) => v === true), [ask]);
  const prompt = useCallback(
    (o: ConfirmOpts & { input?: { placeholder?: string; initial?: string } }) => ask(o).then((v) => (typeof v === "string" ? v : null)),
    [ask]
  );

  const close = (v: string | boolean | null) => {
    pending?.resolve(v);
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-4 md:items-center"
          onClick={() => close(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.title}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") close(null);
              if (e.key === "Enter" && pending.input) close(value);
            }}
          >
            <div className="text-[15px] font-extrabold dark:text-neutral-100">{pending.title}</div>
            {pending.text && <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">{pending.text}</p>}
            {pending.input && (
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={pending.input.placeholder}
                maxLength={100}
                className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-900"
              />
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => close(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                {pending.cancel ?? "Отмена"}
              </button>
              <button
                onClick={() => close(pending.input ? value : true)}
                disabled={!!pending.input && value.trim().length === 0}
                className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white disabled:opacity-40 ${pending.danger ? "bg-red-600 hover:bg-red-500" : "bg-slate-900 hover:bg-slate-700"}`}
              >
                {pending.ok ?? (pending.input ? "Готово" : "Подтвердить")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm outside ConfirmProvider");
  return ctx;
}
