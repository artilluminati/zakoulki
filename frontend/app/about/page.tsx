"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, MessagesSquare, Database, Landmark, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

interface Stats { threads: number; with_geo: number; comments: number; places: number; users: number; }

export default function AboutPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get("/citydata/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const nums: [string, number | undefined][] = [
    ["вопросов задано", stats?.threads],
    ["с точкой на карте", stats?.with_geo],
    ["ответов написано", stats?.comments],
    ["мест в базе", stats?.places],
    ["участников", stats?.users],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 pt-6 md:px-0">
      <div className="rounded-3xl bg-slate-900 p-6 text-white md:p-8">
        <h1 className="text-2xl font-extrabold leading-tight md:text-3xl">
          Спроси город —<br />тебе ответят.
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/70">
          «Закоулки» — место, где жители разбирают городские вопросы: от ямы
          во дворе до судьбы парка. Привяжите вопрос к точке на карте,
          обсудите с соседями и доведите до ответа.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/create" className="rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-extrabold text-slate-900 hover:bg-lime-300">
            Задать вопрос
          </Link>
          <Link href="/map" className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
            Открыть карту
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {nums.map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <div className="text-2xl font-extrabold">{v ?? "…"}</div>
            <div className="text-xs text-slate-500 dark:text-neutral-400">{label}</div>
          </div>
        ))}
        <div className="rounded-2xl border border-dashed border-slate-300 bg-transparent p-4 dark:border-neutral-600">
          <div className="text-2xl font-extrabold text-slate-300 dark:text-neutral-500">↗</div>
          <div className="text-xs text-slate-500 dark:text-neutral-400">растём каждый день</div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {[
          { Icon: MessagesSquare, t: "Спросите", d: "Текст, фото, теги. Коротко как в соцсетях — без бюрократии." },
          { Icon: MapPin, t: "Привяжите", d: "Точка, адрес или организация. Вопрос появится на карте города." },
          { Icon: Landmark, t: "Доведите", d: "Обсуждение, упоминания ответственных, официальные ответы." },
        ].map(({ Icon, t, d }) => (
          <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="mt-2 font-extrabold">{t}</div>
            <div className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-neutral-400">{d}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
        <div className="flex items-center gap-2 font-extrabold text-emerald-900 dark:text-emerald-100">
          <MessagesSquare className="h-5 w-5" /> Разделы мест
        </div>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
          У двора, парка или улицы может быть свой раздел: все его вопросы —
          в одном месте, а общее обсуждение — в отдельном треде.
          Три голоса жителей превращают вопрос с точкой в раздел.
          У раздела есть автор и модераторы.
        </p>
        <Link href="/hubs" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          Все разделы <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950">
        <div className="flex items-center gap-2 font-extrabold text-emerald-900">
          <Landmark className="h-5 w-5" /> Администрациям и организациям
        </div>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/80">
          Заведите официальный аккаунт — отвечайте жителям прямо в тредах,
          получайте упоминания и сводите обращения в одном месте.
          Верификация — через администрацию сервиса.
        </p>
        <Link href="/data" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          На каких данных мы стоим <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center gap-2 font-extrabold">
          <Database className="h-5 w-5 text-slate-500 dark:text-neutral-400" /> Открытые данные
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-neutral-400">
          Карта и геокодинг — на открытых и partner-источниках.
          Готовимся к интеграции городских наборов данных.
        </p>
        <Link href="/data" className="mt-2 inline-block text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          Все источники →
        </Link>
      </div>
    </div>
  );
}
