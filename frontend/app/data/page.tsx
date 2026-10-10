"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, CheckCircle2, KeyRound, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";

interface Source { id: string; name: string; kind: string; status: string; desc: string; }

const STATUS: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  live: { label: "Подключено", cls: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 },
  needs_key: { label: "Нужен ключ", cls: "bg-amber-100 text-amber-800", Icon: KeyRound },
  planned: { label: "Запланировано", cls: "bg-slate-100 text-slate-500", Icon: CalendarClock },
};

export default function DataPage() {
  const [sources, setSources] = useState<Source[]>([]);

  useEffect(() => {
    api.get("/citydata/sources").then((r) => setSources(r.data ?? [])).catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-6 md:px-0">
      <Link href="/about" className="text-sm text-slate-400">← О проекте</Link>
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Database className="h-5 w-5" /> Источники данных
      </h1>
      <p className="text-sm leading-relaxed text-slate-500">
        На чём стоит сервис и что подключается следующим. Реестр открыт —
        так работают ответственные городские продукты.
      </p>
      <div className="space-y-2">
        {sources.map((s) => {
          const st = STATUS[s.status] ?? STATUS.planned;
          return (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold">{s.name}</span>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>
                  <st.Icon className="h-3.5 w-3.5" /> {st.label}
                </span>
                <span className="ml-auto text-xs text-slate-400">{s.kind}</span>
              </div>
              <p className="mt-1 text-[13px] text-slate-500">{s.desc}</p>
            </div>
          );
        })}
        {sources.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            Загружаем реестр…
          </div>
        )}
      </div>
    </div>
  );
}
