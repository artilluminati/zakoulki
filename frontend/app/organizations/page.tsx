import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Landmark, MessagesSquare, ShieldCheck } from "lucide-react";
import OrgApplicationForm from "@/components/OrgApplicationForm";

export const metadata: Metadata = {
  title: "Официальный аккаунт",
  description:
    "Заявка на официальный аккаунт для администраций и организаций: отвечайте жителям в тредах и получайте упоминания.",
};

const PERKS = [
  { Icon: ShieldCheck, t: "Плашка «Официальная организация»", d: "Жители видят, что отвечает проверенный аккаунт." },
  { Icon: MessagesSquare, t: "Ответы прямо в тредах", d: "Упоминания и обращения собираются в одном месте." },
  { Icon: BadgeCheck, t: "Проверка администрацией", d: "Верификация по вашим данным — без публичной огласки." },
];

export default function OrganizationsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 pt-4 md:px-0 md:pt-6">
      <div className="rounded-3xl bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-2 text-emerald-300">
          <Landmark className="h-5 w-5" />
          <span className="text-[13px] font-bold uppercase tracking-wide">Администрациям и организациям</span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">
          Официальный аккаунт — чтобы жители знали, кому пишут
        </h1>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-white/70">
          Отвечайте на вопросы в тредах, получайте упоминания и ведите обращения жителей
          в одном месте. Верификация — через администрацию сервиса.
        </p>
        <Link
          href="/about"
          className="mt-4 inline-block text-sm font-bold text-emerald-300 hover:underline"
        >
          ← О проекте
        </Link>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {PERKS.map(({ Icon, t, d }) => (
          <div
            key={t}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="mt-2 text-sm font-extrabold dark:text-neutral-100">{t}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-neutral-400">{d}</div>
          </div>
        ))}
      </div>

      <OrgApplicationForm />
    </div>
  );
}
