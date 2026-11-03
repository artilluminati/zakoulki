"use client";

import Link from "next/link";
import { Heart, Globe, Image, ShieldCheck, Users, ArrowRight } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { getApiError } from "@/lib/errors";

const PRESETS = [100, 300, 500, 1000];
const MIN_AMOUNT = 50;

export default function DonateForm({ paid }: { paid: boolean }) {
  const [amount, setAmount] = useState(300);
  const [custom, setCustom] = useState("");
  const [donorName, setDonorName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const chosenAmount = custom.trim() ? Number(custom.replace(/\s/g, "")) : amount;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!Number.isFinite(chosenAmount) || chosenAmount < MIN_AMOUNT) {
      setError(`Минимальная сумма поддержки — ${MIN_AMOUNT} ₽`);
      return;
    }

    setBusy(true);
    try {
      const res = await api.post("/donations", {
        amount: Math.round(chosenAmount),
        purpose: "project",
        message: message.trim() ? message.trim() : undefined,
        donor_name: donorName.trim() ? donorName.trim() : undefined,
      });
      const payUrl = res.data?.confirmation_url as string | undefined;
      if (payUrl) {
        window.location.href = payUrl;
        return;
      }
      setCreated(true);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 503) {
        setError("Приём платежей скоро заработает. Мы уже знаем о вашей поддержке — попробуйте ещё раз чуть позже.");
      } else {
        setError(getApiError(err, "Не получилось оформить поддержку — попробуйте ещё раз"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-3 pt-6 md:px-0">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white">
            <Heart className="h-7 w-7" />
          </span>
          <h1 className="mt-3 text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">Спасибо за поддержку!</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
            Платёж прошёл — спасибо. Это помогает Закоулкам жить: держать карту, разбирать вопросы и поддерживать площадку.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-700">
              На главную
            </Link>
            <Link href="/profile" className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900">
              Мой профиль
            </Link>
          </div>
        </div>
        <WhyBlock />
      </div>
    );
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-3 pt-6 md:px-0">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
          <Heart className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <h1 className="mt-3 text-xl font-extrabold text-emerald-900 dark:text-emerald-100">Спасибо!</h1>
          <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
            Поддержка оформлена. Письмо с подтверждением придёт на вашу почту.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-3 pt-4 md:px-0 md:pt-6">
      <div className="rounded-3xl bg-slate-900 p-6 text-white">
        <div className="flex items-center gap-2 text-emerald-300">
          <Heart className="h-5 w-5" />
          <span className="text-[13px] font-bold uppercase tracking-wide">Поддержать проект</span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">Помогите Закоулкам оставаться открытыми</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/70">
          «Закоулки» живут на поддержке жителей: без неё не было бы карты, разборов и ответов.
          Деньги идут на площадку целиком — без рекламы и платных разделов.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="text-sm font-extrabold dark:text-neutral-100">Сумма</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setAmount(p); setCustom(""); }}
                className={`rounded-xl px-4 py-2.5 text-[15px] font-bold transition ${
                  !custom.trim() && amount === p
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {p} ₽
              </button>
            ))}
          </div>
          <label className="mt-2.5 block text-[13px] font-semibold text-slate-500 dark:text-neutral-400">
            Своя сумма
            <input
              type="number"
              min={MIN_AMOUNT}
              step="1"
              inputMode="numeric"
              placeholder={`от ${MIN_AMOUNT} ₽`}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </label>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="text-sm font-extrabold dark:text-neutral-100">На что идёт поддержка</div>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500 bg-emerald-50 px-3.5 py-3 dark:border-emerald-700 dark:bg-emerald-950/50">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                <span className="block text-[15px] font-bold dark:text-neutral-100">На поддержку проекта</span>
                <span className="block text-[13px] text-slate-500 dark:text-neutral-400">
                  Карта, модерация и работа над площадкой
                </span>
              </span>
            </div>
            <div
              aria-disabled="true"
              className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 px-3.5 py-3 opacity-60 dark:border-neutral-700"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 dark:border-neutral-600" />
              <span>
                <span className="block text-[15px] font-bold dark:text-neutral-100">
                  За рекомендацию в разделе «Кто поможет»
                </span>
                <span className="block text-[13px] text-slate-500 dark:text-neutral-400">
                  Скоро — раздел в разработке
                </span>
              </span>
            </div>
          </div>
        </div>


        <div className="space-y-2.5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="text-sm font-extrabold dark:text-neutral-100">Необязательно</div>
          <input
            placeholder="Ваше имя (как подписать поддержку)"
            value={donorName}
            maxLength={120}
            onChange={(e) => setDonorName(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <textarea
            placeholder="Сообщение проекту"
            value={message}
            maxLength={1000}
            rows={2}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[15px] outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        {error && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[15px] font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          <Heart className="h-5 w-5" />
          {busy ? "Секунду…" : `Поддержать${chosenAmount >= MIN_AMOUNT ? ` · ${Math.round(chosenAmount)} ₽` : ""}`}
        </button>
        <p className="pb-2 text-center text-xs text-slate-400 dark:text-neutral-500">
          Платёж проходит на защищённой странице. Поддержавшие проект получают значок.
        </p>
      </form>

      <WhyBlock />
    </div>
  );
}

function WhyBlock() {
  const items = [
    { Icon: Globe, t: "Хостинг и домен", d: "Чтобы сайт и карта открывались быстро и без рекламы." },
    { Icon: Image, t: "Карты и фотографии", d: "Подсказки мест, организации на карте и фото к вопросам." },
    { Icon: ShieldCheck, t: "Модерация", d: "Проверка заявок и разбор спорных вопросов." },
    { Icon: Users, t: "Поддержка сообщества", d: "Помощь жителям: ответы, разборы, обратная связь." },
  ];
  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
      <h2 className="font-extrabold text-emerald-900 dark:text-emerald-100">Зачем это нужно</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map(({ Icon, t, d }) => (
          <div key={t} className="rounded-2xl bg-white/70 p-3.5 dark:bg-neutral-900/50">
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="mt-1.5 text-[14px] font-extrabold text-emerald-900 dark:text-emerald-100">{t}</div>
            <div className="mt-0.5 text-[13px] leading-relaxed text-emerald-900/75 dark:text-emerald-100/75">{d}</div>
          </div>
        ))}
      </div>
      <Link href="/about" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
        О проекте <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
