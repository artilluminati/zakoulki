import { Crown, Heart, ShieldCheck, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Виды бейджей пользователя. Одновременно может быть несколько. */
export type BadgeKind = "official" | "donor" | "sponsor" | "op";

export interface Badge {
  id?: number;
  kind: BadgeKind | string;
  label?: string | null;
  meta?: Record<string, unknown> | null;
}

interface BadgeStyle {
  label: string;
  Icon: LucideIcon;
  cls: string;
  hint: string;
}

/** Единый источник правды: подписи, иконки и цвета бейджей. */
export const BADGE_STYLES: Record<BadgeKind, BadgeStyle> = {
  official: {
    label: "Официальная организация",
    Icon: ShieldCheck,
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    hint: "Статус подтверждён администратором площадки",
  },
  donor: {
    label: "Поддержал проект",
    Icon: Heart,
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    hint: "Помог проекту деньгами",
  },
  sponsor: {
    label: "Спонсор проекта",
    Icon: Star,
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    hint: "Крупная поддержка проекта",
  },
  op: {
    label: "Автор раздела",
    Icon: Crown,
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    hint: "Ведёт раздел на площадке",
  },
};

export function badgeStyle(kind: string): BadgeStyle {
  return (
    BADGE_STYLES[kind as BadgeKind] ?? {
      label: kind,
      Icon: ShieldCheck,
      cls: "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300",
      hint: "",
    }
  );
}

export function badgeLabel(badge: Badge): string {
  return badge.label?.trim() || badgeStyle(badge.kind).label;
}

/** Денежные бейджи — ступени одной награды: показываем только старшую.
 *  Бэкенд тоже склеивает их, это страховка для старых данных в кэше. */
export function visibleBadges(badges: Badge[]): Badge[] {
  const hasSponsor = badges.some((b) => String(b.kind) === "sponsor");
  return hasSponsor ? badges.filter((b) => String(b.kind) !== "donor") : badges;
}

/** Список видов бейджей — для выпадающих списков в админке. */
export const BADGE_KINDS = (Object.keys(BADGE_STYLES) as BadgeKind[]).map((kind) => ({
  kind,
  label: BADGE_STYLES[kind].label,
  Icon: BADGE_STYLES[kind].Icon,
}));
