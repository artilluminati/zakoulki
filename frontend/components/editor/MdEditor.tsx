"use client";

import { useRef, useState } from "react";
import PlaceSuggest from "./PlaceSuggest";

export default function MdEditor({
  value, onChange, placeholder, compact = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [plusQuery, setPlusQuery] = useState<string | null>(null);

  const wrap = (before: string, after = "") => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || "текст";
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };

  const trackPlus = (v: string, cursor: number) => {
    // ищем `+слово` перед курсором
    const before = v.slice(0, cursor);
    const m = before.match(/\+([а-яА-ЯёЁa-zA-Z0-9 ]{0,40})$/);
    setPlusQuery(m ? m[1].trimStart() : null);
  };

  return (
    <div className="relative overflow-visible rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <button type="button" title="Жирный (Ctrl+B)" onClick={() => wrap("**", "**")} className="rounded px-2 py-1 text-sm font-bold hover:bg-slate-200">B</button>
        <button type="button" title="Курсив (Ctrl+I)" onClick={() => wrap("*", "*")} className="rounded px-2 py-1 text-sm italic hover:bg-slate-200">I</button>
        {!compact && (
          <>
            <button type="button" onClick={() => wrap("> ")} className="rounded px-2 py-1 hover:bg-slate-200">❝</button>
            <button type="button" onClick={() => wrap("- ")} className="rounded px-2 py-1 hover:bg-slate-200">•</button>
            <button type="button" title="Ссылка (Ctrl+K)" onClick={() => wrap("[", "](https://)")} className="rounded px-2 py-1 hover:bg-slate-200">🔗</button>
          </>
        )}
        <button type="button" title="Человек" onClick={() => ref.current && (ref.current.setRangeText("@", ref.current.selectionStart, ref.current.selectionEnd, "end"), onChange(ref.current.value))} className="rounded px-2 py-1 hover:bg-slate-200">@</button>
        <button type="button" title="Место" onClick={() => ref.current && (ref.current.setRangeText("+", ref.current.selectionStart, ref.current.selectionEnd, "end"), onChange(ref.current.value), ref.current.focus())} className="rounded px-2 py-1 hover:bg-slate-200">📍</button>
        <button type="button" title="Тег" onClick={() => ref.current && (ref.current.setRangeText("#", ref.current.selectionStart, ref.current.selectionEnd, "end"), onChange(ref.current.value), ref.current.focus())} className="rounded px-2 py-1 hover:bg-slate-200">#</button>
        <div className="ml-auto flex rounded-lg bg-slate-200/70 p-0.5 text-xs">
          <button type="button" onClick={() => setTab("write")} className={`rounded-md px-2 py-1 ${tab === "write" ? "bg-white shadow" : ""}`}>Писать</button>
          <button type="button" onClick={() => setTab("preview")} className={`rounded-md px-2 py-1 ${tab === "preview" ? "bg-white shadow" : ""}`}>Просмотр</button>
        </div>
      </div>
      {tab === "write" ? (
        <>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => { onChange(e.target.value); trackPlus(e.target.value, e.target.selectionStart ?? 0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPlusQuery(null);
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrap("**", "**"); }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); wrap("*", "*"); }
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); wrap("[", "](https://)"); }
            }}
            placeholder={placeholder ?? "О чем хотите спросить? @ — человек, + — место, # — тема"}
            rows={compact ? 3 : 5}
            className="w-full resize-y bg-white px-3 py-2 text-[15px] outline-none placeholder:text-slate-400"
          />
          {plusQuery !== null && (
            <PlaceSuggest
              query={plusQuery}
              onClose={() => setPlusQuery(null)}
              onPick={(p) => {
                const el = ref.current;
                if (!el) return;
                const pos = el.selectionStart ?? value.length;
                const before = value.slice(0, pos).replace(/\+[а-яА-ЯёЁa-zA-Z0-9 ]*$/, `+[${p.id}:${p.name}] `);
                const next = before + value.slice(pos);
                onChange(next);
              }}
            />
          )}
        </>
      ) : (
        <div className="min-h-[80px] px-3 py-2 text-[15px] text-slate-500">
          Превью отрендерит сервер: места — чипом с иконкой и тултипом (фото + улица · район).
        </div>
      )}
      <div className="border-t border-slate-100 px-3 py-1 text-xs text-slate-400">
        **жирный** *курсив* [текст](ссылка) · `@` человек · `+` место · `#` тег
      </div>
    </div>
  );
}
