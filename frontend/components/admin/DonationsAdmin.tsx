"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка донатов с сервера */

import { useCallback, useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { api } from "@/lib/api";
import {
  Counter,
  EmptyBlock,
  ErrorBlock,
  LoadingRows,
  dateTimeRu,
  errMessage,
  moneyRu,
} from "./common";

interface Donation {
  id: number;
  amount: number;
  purpose: string;
  status: string;
  message: string | null;
  donor_name: string | null;
  donor_email: string | null;
  user_id: number | null;
  badge_granted: boolean;
  recommendation_id: number | null;
  provider_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
}

type Filter = "all" | "pending" | "paid" | "failed" | "refunded";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "pending", label: "В ожидании" },
  { id: "paid", label: "Оплачен" },
  { id: "failed", label: "Не оплачен" },
  { id: "refunded", label: "Возвращён" },
];

const PURPOSES: Record<string, string> = {
  project: "На поддержку проекта",
  recommendation: "За рекомендацию",
};

const STATUSES: Record<string, { label: string; cls: string }> = {
  pending: { label: "В ожидании", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  paid: { label: "Оплачен", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  failed: { label: "Не оплачен", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  refunded: { label: "Возвращён", cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" },
};

export default function DonationsAdmin() {
  const [items, setItems] = useState<Donation[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/donations", { params: f === "all" ? {} : { status: f } });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить донаты"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const total = items.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <HeartHandshake className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Донаты
        </h2>
        <Counter count={items.length} label="шт." />
        {items.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            всего {moneyRu(total)}
          </span>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${
              filter === f.id
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 text-slate-500 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <LoadingRows rows={3} />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => load(filter)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyBlock
          icon={<HeartHandshake className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title="Донатов нет"
          text="Здесь появятся переводы в поддержку проекта и оплаченные заявки."
        />
      )}

      {/* мобильный вид — карточки */}
      <div className="space-y-2 sm:hidden">
        {items.map((d) => {
          const st = STATUSES[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" };
          return (
            <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold dark:text-neutral-100">{moneyRu(d.amount)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                {d.badge_granted && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">бейдж выдан</span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
                {PURPOSES[d.purpose] ?? d.purpose}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-neutral-400">
                {[d.donor_name, d.donor_email].filter(Boolean).join(" · ") || "Аноним"}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 dark:text-neutral-500">
                {dateTimeRu(d.paid_at ?? d.created_at)}
              </div>
              {d.message && <div className="mt-1 text-[13px] text-slate-600 dark:text-neutral-300">{d.message}</div>}
            </div>
          );
        })}
      </div>

      {/* десктоп — таблица */}
      {items.length > 0 && (
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white sm:block dark:border-neutral-700 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-neutral-800 dark:text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-bold">Сумма</th>
                  <th className="px-4 py-2 font-bold">Назначение</th>
                  <th className="px-4 py-2 font-bold">Статус</th>
                  <th className="px-4 py-2 font-bold">Донор</th>
                  <th className="px-4 py-2 font-bold">Дата</th>
                  <th className="px-4 py-2 font-bold">Бейдж</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => {
                  const st = STATUSES[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" };
                  return (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0 dark:border-neutral-800">
                      <td className="whitespace-nowrap px-4 py-2.5 font-extrabold dark:text-neutral-100">{moneyRu(d.amount)}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-neutral-300">
                        {PURPOSES[d.purpose] ?? d.purpose}
                        {d.message && <div className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">{d.message}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-neutral-300">
                        {d.donor_name || "Аноним"}
                        {d.donor_email && <div className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">{d.donor_email}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-neutral-400">
                        {dateTimeRu(d.created_at)}
                        {d.paid_at && <div className="mt-0.5">оплачен {dateTimeRu(d.paid_at)}</div>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {d.badge_granted ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">выдан</span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-neutral-500">нет</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
