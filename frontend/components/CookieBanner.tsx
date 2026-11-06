"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const KEY = "zakoulki_cookie_consent_v1";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (!v) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-start gap-2.5">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-neutral-300">
            Мы используем файлы cookie и счётчики аналитики (Яндекс.Метрика), чтобы понимать,
            как работает сайт и улучшать его. Продолжая пользоваться сайтом, вы соглашаетесь
            с{" "}
            <Link href="/privacy" className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">
              Политикой конфиденциальности
            </Link>{" "}
            и{" "}
            <Link href="/terms" className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">
              Пользовательским соглашением
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={accept}
            className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-slate-700 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-neutral-200"
          >
            Понятно
          </button>
          <button
            type="button"
            onClick={accept}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
