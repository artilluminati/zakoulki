"use client";
/* eslint-disable react-hooks/set-state-in-effect -- чтение флага онбординга из localStorage */

import { useEffect, useState } from "react";
import { X, MessagesSquare, MapPin, HelpCircle, Globe2 } from "lucide-react";
import ScopePicker from "@/components/ScopePicker";
import { useScope, scopeLabel } from "@/lib/scope";

const KEY = "zakoulki_onboarding_v2";

const STEPS = [
  { title: "Откуда вы?", text: "Покажем вопросы вашего города и района. Можно выбрать всю страну или весь мир — меняется в один тап.", Icon: Globe2, location: true },
  { title: "Вопросы города", text: "От ямы во дворе до судьбы парка — спрашивайте о важном, отвечайте другим.", Icon: MessagesSquare },
  { title: "Спросите — ответят", text: "Опишите проблему, прикрепите точку на карте — вопрос увидят те, кому он важен.", Icon: HelpCircle },
  { title: "Все на карте", text: "Каждый вопрос с местом виден на карте. Похожие темы подсвечиваем заранее, чтобы не дублировать.", Icon: MapPin },
];

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { scope, setScope } = useScope();

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch { setOpen(true); }
  }, []);

  if (!open) return null;
  const s = STEPS[step];

  const close = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 md:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-100">
            <s.Icon className="h-7 w-7 text-lime-700" />
          </span>
          <button onClick={close} aria-label="Пропустить" className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 className="mt-3 text-xl font-extrabold">{s.title}</h2>
        <p className="mt-1 text-[15px] text-slate-600">{s.text}</p>
        {"location" in s && s.location && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3">
            <ScopePicker value={scope} onChange={setScope} />
            <div className="mt-2 text-center text-xs text-slate-400">Сейчас: {scopeLabel(scope)}</div>
          </div>
        )}
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i === step ? "bg-lime-500" : "bg-slate-200"}`} />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          {step < STEPS.length - 1 ? (
            <>
              <button onClick={close} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold">Пропустить</button>
              <button onClick={() => setStep(step + 1)} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">Далее</button>
            </>
          ) : (
            <button onClick={close} className="flex-1 rounded-xl bg-lime-400 py-2.5 text-sm font-extrabold text-slate-900 hover:bg-lime-300">
              Смотреть ленту
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
