"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка рекомендаций с сервера */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Megaphone, ThumbsDown } from "lucide-react";
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
} from "./common";

interface Recommendation {
  id: number;
  title: string;
  description: string | null;
  contact: string | null;
  url: string | null;
  topic: string | null;
  topic_label: string | null;
  status: string;
  user_id: number | null;
  donation_id: number | null;
  created_at: string;
  published_at: string | null;
}

type Filter = "all" | "pending" | "published" | "rejected";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "pending", label: "В ожидании" },
  { id: "published", label: "Опубликованные" },
  { id: "rejected", label: "Отклонённые" },
];

const TOPICS: { id: string; label: string }[] = [
  { id: "zhkh", label: "ЖКХ" },
  { id: "repair", label: "Ремонт" },
  { id: "law", label: "Юридическая помощь" },
  { id: "transport", label: "Транспорт" },
  { id: "other", label: "Другое" },
];

const STATUSES: Record<string, { label: string; cls: string }> = {
  pending: { label: "в ожидании", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  published: { label: "опубликована", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  rejected: { label: "отклонена", cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" },
};

export default function RecommendationsAdmin() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [topic, setTopic] = useState("zhkh");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/recommendations", { params: f === "all" ? {} : { status: f } });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMessage(e, "Не получилось загрузить заявки"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  const publish = async (r: Recommendation) => {
    setBusy(true);
    try {
      await api.patch(`/admin/recommendations/${r.id}`, { status: "published", topic });
      toast("Заявка опубликована", "success");
      setPublishing(null);
      load(filter);
    } catch (e) {
      toast(errMessage(e, "Не получилось опубликовать заявку"), "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (r: Recommendation) => {
    if (!(await confirm({
      title: `Отклонить заявку «${r.title}»?`,
      text: "Заявка не появится в блоке «Кто поможет».",
      ok: "Отклонить",
      danger: true,
    }))) return;
    setBusy(true);
    try {
      await api.patch(`/admin/recommendations/${r.id}`, { status: "rejected" });
      toast("Заявка отклонена", "success");
      load(filter);
    } catch (e) {
      toast(errMessage(e, "Не получилось отклонить заявку"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <Megaphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Рекомендации
        </h2>
        <Counter count={items.length} label="шт." />
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

      {loading && <LoadingRows rows={2} />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => load(filter)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyBlock
          icon={<Megaphone className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title="Заявок нет"
          text="Раздел пока в разработке: новые заявки не принимаются. Здесь появятся оплаченные заявки на размещение в блоке «Кто поможет»."
        />
      )}

      <div className="space-y-2">
        {items.map((r) => {
          const st = STATUSES[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" };
          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-extrabold dark:text-neutral-100">{r.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                {r.donation_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> оплачено
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    не оплачено
                  </span>
                )}
              </div>

              {r.description && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-neutral-300">{r.description}</p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-neutral-400">
                <span>тема: {r.topic_label ?? TOPICS.find((t) => t.id === r.topic)?.label ?? "—"}</span>
                {r.contact && <span>контакт: {r.contact}</span>}
                <span>создана {dateRu(r.created_at)}</span>
                {r.published_at && <span>опубликована {dateRu(r.published_at)}</span>}
              </div>

              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {r.url}
                </a>
              )}

              {publishing === r.id && (
                <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <span className="text-xs font-bold text-slate-600 dark:text-neutral-300">Выберите тему</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {TOPICS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTopic(t.id)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          topic === t.id
                            ? "bg-emerald-600 text-white"
                            : "bg-white text-slate-600 dark:bg-neutral-900 dark:text-neutral-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={() => publish(r)} disabled={busy} className={btnPrimary}>
                      {busy ? "Публикуем…" : "Опубликовать"}
                    </button>
                    <button onClick={() => setPublishing(null)} className={btnGhost}>Отмена</button>
                  </div>
                </div>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.status !== "published" && (
                  <button
                    onClick={() => { setPublishing(r.id); setTopic(r.topic ?? "zhkh"); }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Опубликовать
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    onClick={() => reject(r)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> Отклонить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
