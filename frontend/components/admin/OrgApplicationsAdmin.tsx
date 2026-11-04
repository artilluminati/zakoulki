"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка заявок с сервера */

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, ExternalLink, Landmark, ThumbsDown } from "lucide-react";
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

interface OrgApplication {
  id: number;
  kind: string;
  kind_label: string;
  org_name: string;
  city: string | null;
  address: string | null;
  website: string | null;
  description: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  account_mode: string;
  existing_account: string | null;
  user_id: number | null;
  username: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

type Filter = "all" | "pending" | "approved" | "rejected";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "На проверке" },
  { id: "approved", label: "Одобренные" },
  { id: "rejected", label: "Отклонённые" },
  { id: "all", label: "Все" },
];

const STATUSES: Record<string, { label: string; cls: string }> = {
  pending: { label: "на проверке", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  approved: { label: "одобрена", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  rejected: { label: "отклонена", cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" },
};

export default function OrgApplicationsAdmin() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<OrgApplication[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const res = await api.get("/admin/org-applications", { params: f === "all" ? {} : { status: f } });
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

  const setStatus = async (a: OrgApplication, status: "approved" | "rejected") => {
    if (status === "rejected") {
      const ok = await confirm({
        title: `Отклонить заявку «${a.org_name}»?`,
        text: "Аккаунт останется обычным, официальная плашка не появится.",
        ok: "Отклонить",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(a.id);
    try {
      await api.patch(`/admin/org-applications/${a.id}`, { status });
      toast(status === "approved" ? "Заявка одобрена, бейдж выдан" : "Заявка отклонена", "success");
      load(filter);
    } catch (e) {
      toast(errMessage(e, "Не получилось обновить заявку"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold dark:text-neutral-100">
          <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Заявки организаций
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
          icon={<Landmark className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          title="Заявок нет"
          text="Здесь появятся заявки администраций и организаций на официальный аккаунт."
        />
      )}

      <div className="space-y-2">
        {items.map((a) => {
          const st = STATUSES[a.status] ?? {
            label: a.status,
            cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400",
          };
          return (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {a.kind === "administration" ? <Landmark className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                  {a.kind_label}
                </span>
                <span className="min-w-0 flex-1 text-sm font-extrabold dark:text-neutral-100">{a.org_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
              </div>

              {a.description && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 dark:text-neutral-300">{a.description}</p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-neutral-400">
                {a.city && <span>{a.city}</span>}
                {a.address && <span>{a.address}</span>}
                <span>создана {dateRu(a.created_at)}</span>
                {a.reviewed_at && <span>проверена {dateRu(a.reviewed_at)}</span>}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-neutral-400">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">{a.contact_name}</span>
                <a href={`mailto:${a.contact_email}`} className="text-emerald-700 hover:underline dark:text-emerald-300">
                  {a.contact_email}
                </a>
                {a.contact_phone && <a href={`tel:${a.contact_phone}`} className="hover:underline">{a.contact_phone}</a>}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                {a.account_mode === "new" ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    аккаунт создан{a.username ? `: ${a.username}` : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                    существующий: {a.existing_account ?? "—"}
                    {a.username ? ` → ${a.username}` : ""}
                  </span>
                )}
              </div>

              {a.website && (
                <a
                  href={a.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {a.website}
                </a>
              )}

              {a.admin_note && (
                <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-neutral-800 dark:text-neutral-300">
                  Заметка: {a.admin_note}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {a.status !== "approved" && (
                  <button
                    onClick={() => setStatus(a, "approved")}
                    disabled={busy === a.id}
                    className={btnPrimary}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> {busy === a.id ? "Выдаём…" : "Одобрить и выдать бейдж"}
                  </button>
                )}
                {a.status !== "rejected" && (
                  <button
                    onClick={() => setStatus(a, "rejected")}
                    disabled={busy === a.id}
                    className={btnGhost}
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
