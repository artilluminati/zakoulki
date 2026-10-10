"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Quote, List, Link2, AtSign, MapPin, Hash } from "lucide-react";
import PlaceSuggest from "./PlaceSuggest";
import UserSuggest from "./UserSuggest";
import { renderPreview } from "@/lib/mdPreview";

export default function MdEditor({
  value, onChange, placeholder, compact = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [plusQuery, setPlusQuery] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState<string | null>(null);
  const [scroll, setScroll] = useState(0);

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
    const before = v.slice(0, cursor);
    const pm = before.match(/\+([а-яА-ЯёЁa-zA-Z0-9 ]{0,40})$/);
    setPlusQuery(pm ? pm[1].trimStart() : null);
    const um = before.match(/(?:^|\s)@([а-яА-ЯёЁa-zA-Z0-9_]{0,40})$/);
    setUserQuery(um ? um[1] : null);
  };

  return (
    <div className="relative overflow-visible rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-2 py-1.5 [&>button]:shrink-0">
        <button type="button" title="Жирный (Ctrl+B)" onClick={() => wrap("**", "**")} className="rounded p-2 hover:bg-slate-200"><Bold className="h-4 w-4" /></button>
        <button type="button" title="Курсив (Ctrl+I)" onClick={() => wrap("*", "*")} className="rounded p-2 hover:bg-slate-200"><Italic className="h-4 w-4" /></button>
        {!compact && (
          <>
            <button type="button" title="Цитата" onClick={() => wrap("> ")} className="rounded p-2 hover:bg-slate-200"><Quote className="h-4 w-4" /></button>
            <button type="button" title="Список" onClick={() => wrap("- ")} className="rounded p-2 hover:bg-slate-200"><List className="h-4 w-4" /></button>
            <button type="button" title="Ссылка (Ctrl+K)" onClick={() => wrap("[", "](https://)")} className="rounded p-2 hover:bg-slate-200"><Link2 className="h-4 w-4" /></button>
          </>
        )}
        <button type="button" title="Упомянуть человека" onClick={() => ref.current && (ref.current.setRangeText("@", ref.current.selectionStart, ref.current.selectionEnd, "end"), onChange(ref.current.value), ref.current.focus())} className="rounded p-2 hover:bg-slate-200"><AtSign className="h-4 w-4" /></button>
        <button type="button" title="Прикрепить место" onClick={() => ref.current && (ref.current.setRangeText("+", ref.current.selectionStart, ref.current.selectionEnd, "end"), onChange(ref.current.value), ref.current.focus())} className="rounded p-2 hover:bg-slate-200"><MapPin className="h-4 w-4" /></button>
        <button type="button" title="Тег" onClick={() => ref.current && (ref.current.setRangeText("#", ref.current.selectionStart, ref.current.selectionEnd, "end"), onChange(ref.current.value), ref.current.focus())} className="rounded p-2 hover:bg-slate-200"><Hash className="h-4 w-4" /></button>
        <div className="ml-auto flex shrink-0 items-center px-1 text-[11px] text-slate-400">
          возможен markdown
        </div>
      </div>
      <div className="relative">
        {value && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2">
            <div
              className="pv-preview whitespace-pre-wrap break-words text-[15px] leading-6"
              style={{ transform: `translateY(${-scroll}px)` }}
              dangerouslySetInnerHTML={{ __html: renderPreview(value) }}
            />
          </div>
        )}
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => { onChange(e.target.value); trackPlus(e.target.value, e.target.selectionStart ?? 0); }}
          onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setPlusQuery(null); setUserQuery(null); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrap("**", "**"); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); wrap("*", "*"); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); wrap("[", "](https://)"); }
          }}
          placeholder={placeholder ?? "О чем хотите спросить? @ — человек, + — место, # — тема"}
          rows={compact ? 3 : 5}
          className="relative w-full resize-y whitespace-pre-wrap break-words bg-transparent px-3 py-2 text-[15px] leading-6 text-transparent caret-slate-900 outline-none selection:bg-lime-200/60 placeholder:text-slate-400"
        />
        {plusQuery !== null && (
          <PlaceSuggest
              query={plusQuery}
              onClose={() => setPlusQuery(null)}
              onPick={async (p) => {
                const el = ref.current;
                if (!el) return;
                let pid = p.id;
                if (pid === 0) {
                  // результат геокодера — закрепляем в своей базе
                  const { createGeoPlace } = await import("@/lib/v5");
                  const saved = await createGeoPlace({
                    name: p.name, latitude: p.lat, longitude: p.lng,
                    address: p.address, district: p.district, street: p.street,
                  });
                  pid = saved.id;
                }
                const pos = el.selectionStart ?? value.length;
                const before = value.slice(0, pos).replace(/\+[а-яА-ЯёЁa-zA-Z0-9 ]*$/, `+[${pid}:${p.name}] `);
                onChange(before + value.slice(pos));
              }}
            />
          )}
          {userQuery !== null && (
            <UserSuggest
              query={userQuery}
              onClose={() => setUserQuery(null)}
              onPick={(u) => {
                const el = ref.current;
                if (!el) return;
                const pos = el.selectionStart ?? value.length;
                const before = value.slice(0, pos).replace(/@([а-яА-ЯёЁa-zA-Z0-9_]*)$/, `@[${u.id}:${u.username}] `);
                onChange(before + value.slice(pos));
              }}
            />
          )}
      </div>
    </div>
  );
}
