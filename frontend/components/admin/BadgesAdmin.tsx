"use client";

import { useState } from "react";
import { BadgeCheck, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { BADGE_KINDS as BADGE_KINDS_ALL } from "@/lib/badges";
import { useToast } from "@/lib/toast";
import { useConfirm } from "@/lib/confirm";
import { errMessage, inputCls } from "./common";

export interface UserBadge {
  id: number;
  kind: string;
  label: string | null;
  meta?: Record<string, unknown> | null;
}

export const BADGE_KINDS = BADGE_KINDS_ALL;

export function badgeLabel(kind: string, label?: string | null): string {
  if (label && label.trim()) return label.trim();
  return BADGE_KINDS.find((b) => b.kind === kind)?.label ?? kind;
}

function badgeIcon(kind: string) {
  return BADGE_KINDS.find((b) => b.kind === kind)?.Icon ?? BadgeCheck;
}

/**
 * Ячейка с бейджами пользователя: выдача нового и снятие существующих.
 * Сама ходит в данные и обновляет список через onChanged.
 */
export default function BadgesAdmin({
  userId,
  username,
  badges,
  onChanged,
}: {
  userId: number;
  username: string;
  badges: UserBadge[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("official");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const grant = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/admin/users/${userId}/badges`, {
        kind,
        label: label.trim() || undefined,
      });
      toast(`Бейдж «${badgeLabel(kind, label)}» выдан @${username}`, "success");
      setOpen(false);
      setLabel("");
      onChanged();
    } catch (e) {
      toast(errMessage(e, "Не получилось выдать бейдж"), "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (b: UserBadge) => {
    const name = badgeLabel(b.kind, b.label);
    if (!(await confirm({
      title: `Снять бейдж «${name}» у @${username}?`,
      text: "Плашка исчезнет у пользователя.",
      ok: "Снять",
      danger: true,
    }))) return;
    try {
      await api.delete(`/admin/users/${userId}/badges/${b.id}`);
      toast("Бейдж снят", "success");
      onChanged();
    } catch (e) {
      toast(errMessage(e, "Не получилось снять бейдж"), "error");
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {badges.length === 0 && (
          <span className="text-xs text-slate-400 dark:text-neutral-500">нет плашек</span>
        )}
        {badges.map((b) => {
          const Icon = badgeIcon(b.kind);
          return (
            <span
              key={b.id}
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 py-0.5 pl-2 pr-1 text-[11px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
            >
              <Icon className="h-3 w-3" />
              {badgeLabel(b.kind, b.label)}
              <button
                onClick={() => revoke(b)}
                aria-label="Снять бейдж"
                title="Снять бейдж"
                className="rounded-full p-0.5 text-sky-500 hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-900 dark:hover:text-sky-200"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-emerald-300"
          >
            <Plus className="h-3 w-3" /> Выдать бейдж
          </button>
        )}
      </div>

      {open && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-neutral-700 dark:bg-neutral-800/60">
          <div className="flex flex-wrap gap-1.5">
            {BADGE_KINDS.map((b) => (
              <button
                key={b.kind}
                onClick={() => setKind(b.kind)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                  kind === b.kind
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 dark:bg-neutral-900 dark:text-neutral-300"
                }`}
              >
                <b.Icon className="h-3 w-3" /> {b.label}
              </button>
            ))}
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="Подпись (необязательно)"
            className={inputCls}
          />
          <div className="flex gap-1.5">
            <button onClick={grant} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Выдаём…" : "Выдать"}
            </button>
            <button
              onClick={() => { setOpen(false); setLabel(""); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:border-neutral-700 dark:text-neutral-400"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
