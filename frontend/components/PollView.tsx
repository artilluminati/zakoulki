"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { votePoll } from "@/lib/v5";
import { useToast } from "@/lib/toast";
import type { PollV5 } from "@/types/v5";

/** Опрос отдельным блоком: варианты с процентами, голосование как в ТГ. */
export default function PollView({ threadId, initial, canVote }: {
  threadId: number;
  initial: PollV5;
  canVote: boolean;
}) {
  const toast = useToast();
  const [poll, setPoll] = useState<PollV5>(initial);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) => {
    if (poll.multiple) {
      setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
    } else {
      setPicked([id]);
    }
  };

  const send = async () => {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      const updated = await votePoll(threadId, picked);
      setPoll(updated);
      setPicked([]);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast(status === 401 ? "Войдите, чтобы голосовать" : "Не получилось", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 text-sm font-bold">
        <BarChart3 className="h-4 w-4 text-emerald-600" /> {poll.question}
      </div>
      <div className="space-y-1.5 p-3">
        {poll.options.map((o) => {
          const pct = poll.total > 0 ? Math.round((o.votes / poll.total) * 100) : 0;
          const isVoted = poll.voted.includes(o.id);
          const isPicked = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={!canVote}
              onClick={() => toggle(o.id)}
              className={`relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition ${
                isPicked ? "border-emerald-500 bg-emerald-50 font-bold" : "border-slate-200 bg-white hover:border-slate-300"
              } ${!canVote ? "cursor-default" : ""}`}
            >
              <span className="absolute inset-y-0 left-0 bg-emerald-100/70" style={{ width: `${pct}%` }} />
              <span className="relative flex items-center justify-between gap-2">
                <span>{o.text} {isVoted && "· ваш голос"}</span>
                <span className="shrink-0 font-bold text-slate-500">{pct}%</span>
              </span>
            </button>
          );
        })}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">
            Голосов: {poll.total}{poll.multiple ? " · можно несколько" : ""}
          </span>
          {canVote && (
            <button
              onClick={send}
              disabled={picked.length === 0 || busy}
              className="rounded-xl bg-slate-900 px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-40"
            >
              {busy ? "…" : poll.voted.length > 0 ? "Переголосовать" : "Голосовать"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
