"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { scoreThread, scoreComment } from "@/lib/v5";
import { useScore, writeScore } from "@/lib/scoreCache";
import { useToast } from "@/lib/toast";

/** Голоса как на реддите: стрелка вверх/вниз, счёт между ними. */
export default function ScoreArrows({ id, score, myVote, vertical = false, comment = false }: {
  id: number;
  score: number;
  myVote?: number | null;
  vertical?: boolean;
  comment?: boolean;
}) {
  const toast = useToast();
  const key = `${comment ? "c" : "t"}${id}`;
  const live = useScore(key, { score: score ?? 0, my_vote: myVote ?? 0 });
  const [busy, setBusy] = useState(false);
  const mine = live.my_vote;
  const value = live.score;

  const vote = async (v: 1 | -1) => {
    if (busy) return;
    setBusy(true);
    const prev = live;
    const next = mine === v ? 0 : v;
    writeScore(key, { score: prev.score + (next - prev.my_vote), my_vote: next });
    try {
      const send = next === 0 ? (mine === 1 ? 1 : -1) : next;
      const r = comment ? await scoreComment(id, send) : await scoreThread(id, send);
      writeScore(key, { score: r.score, my_vote: r.my_vote });
    } catch (e) {
      writeScore(key, prev);
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast(status === 401 ? "Войдите, чтобы голосовать" : "Не получилось", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`flex items-center gap-0.5 ${vertical ? "flex-col" : ""}`}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); vote(1); }}
        aria-label="Голос за"
        className={`rounded p-0.5 ${mine === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 hover:text-emerald-600 dark:text-neutral-500"}`}
      >
        <ChevronUp className={`h-5 w-5 ${mine === 1 ? "fill-emerald-600/20" : ""}`} strokeWidth={2.5} />
      </button>
      <span className={`min-w-6 text-center text-[13px] font-extrabold tabular-nums ${value > 0 ? "text-emerald-600 dark:text-emerald-400" : value < 0 ? "text-red-500" : "text-slate-500 dark:text-neutral-400"}`}>
        {value}
      </span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); vote(-1); }}
        aria-label="Голос против"
        className={`rounded p-0.5 ${mine === -1 ? "text-red-500" : "text-slate-400 hover:text-red-500 dark:text-neutral-500"}`}
      >
        <ChevronDown className={`h-5 w-5 ${mine === -1 ? "fill-red-500/20" : ""}`} strokeWidth={2.5} />
      </button>
    </span>
  );
}
