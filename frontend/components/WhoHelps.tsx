"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, ExternalLink, HandHeart } from "lucide-react";
import { api } from "@/lib/api";

export interface Recommendation {
  id: number;
  title: string;
  description?: string | null;
  contact: string;
  url?: string | null;
  topic: string;
  topic_label: string;
  published_at?: string | null;
  expires_at?: string | null;
}

export default function WhoHelps({ limit = 12 }: { limit?: number }) {
  const [items, setItems] = useState<Recommendation[]>([]);

  useEffect(() => {
    api.get("/recommendations", { params: { limit } })
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]));
  }, [limit]);

  // нет проверенных рекомендаций — не показываем пустой блок
  if (items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <HandHeart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <h2 className="font-extrabold text-emerald-900 dark:text-emerald-100">Кто поможет</h2>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-bold text-emerald-700 dark:bg-neutral-900 dark:text-emerald-300">
          {items.length}
        </span>
        <Link href="/donate" className="ml-auto text-[13px] font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          Добавить свою →
        </Link>
      </div>
      <p className="mt-1 text-[13px] text-emerald-900/70 dark:text-emerald-100/70">
        Проверенные контакты мастеров и служб — модерация проверяет каждую заявку.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-emerald-100 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold">{r.title}</div>
                <div className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {r.topic_label}
                </div>
              </div>
            </div>
            {r.description && (
              <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-slate-500 dark:text-neutral-400">
                {r.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                <Phone className="h-3.5 w-3.5" /> {r.contact}
              </span>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Подробнее
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
