"use client";

import { badgeStyle, type Badge } from "@/lib/badges";

export type { Badge, BadgeKind } from "@/lib/badges";

/** Сумма доната из meta — показываем честно, если она есть. */
function metaAmount(meta?: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  const raw = meta.amount;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

export default function UserBadges({
  badges,
  mode = "inline",
  className = "",
}: {
  badges?: Badge[] | null;
  mode?: "inline" | "stack";
  className?: string;
}) {
  const list = (badges ?? []).filter(Boolean);
  if (list.length === 0) return null;

  if (mode === "stack") {
    return (
      <ul className={`flex flex-col gap-1.5 ${className}`}>
        {list.map((b, i) => {
          const s = badgeStyle(String(b.kind));
          const Icon = s.Icon;
          const amount = metaAmount(b.meta);
          return (
            <li
              key={b.id ?? `${b.kind}-${i}`}
              title={s.hint}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] font-bold ${s.cls}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{b.label?.trim() || s.label}</span>
              {amount != null && (
                <span className="ml-auto shrink-0 text-[12px] font-semibold opacity-80">{amount} ₽</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {list.map((b, i) => {
        const s = badgeStyle(String(b.kind));
        const Icon = s.Icon;
        return (
          <span
            key={b.id ?? `${b.kind}-${i}`}
            title={s.hint}
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[11px] font-bold ${s.cls}`}
          >
            <Icon className="h-3 w-3" /> {b.label?.trim() || s.label}
          </span>
        );
      })}
    </span>
  );
}
