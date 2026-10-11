"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Quote, List, Link2, AtSign, MapPin, Hash, Copy, Check } from "lucide-react";
import PlaceSuggest from "./PlaceSuggest";
import UserSuggest from "./UserSuggest";
import type { SuggestCtl } from "./suggest";
import { renderLine } from "@/lib/mdPreview";

export default function MdEditor({
  value, onChange, placeholder, compact = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; compact?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [plusQuery, setPlusQuery] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const caretRef = useRef<number | null>(null);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const plusCtl = useRef<SuggestCtl | null>(null);
  const userCtl = useRef<SuggestCtl | null>(null);

  const lines = value.split("\n");

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const focusActive = (idx: number, caret?: number) => {
    caretRef.current = caret ?? null;
    setActive(idx);
  };

  // если строк стало меньше чем active (очистка извне) — считаем сброшенным без эффекта
  const safeActive = active !== null && active < lines.length ? active : null;

  // фокус + каретка после активации строки
  useEffect(() => {
    const el = areaRef.current;
    if (el && safeActive !== null) {
      el.focus({ preventScroll: true });
      const pos = caretRef.current ?? el.value.length;
      caretRef.current = null;
      el.setSelectionRange(pos, pos);
      autoGrow(el);
    }
  }, [safeActive]);

  const commitLines = (next: string[], focusIdx?: number, caret?: number) => {
    onChange(next.join("\n"));
    if (focusIdx !== undefined) focusActive(focusIdx, caret);
  };

  const lineStart = (idx: number) => lines.slice(0, idx).join("\n").length + (idx > 0 ? 1 : 0);

  const copyAll = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const trackQueries = (full: string, cursor: number) => {
    const before = full.slice(0, cursor);
    const pm = before.match(/\+([а-яА-ЯёЁa-zA-Z0-9 ]{0,40})$/);
    setPlusQuery(pm ? pm[1].trimStart() : null);
    const um = before.match(/(?:^|\s)@([а-яА-ЯёЁa-zA-Z0-9_]{0,40})$/);
    setUserQuery(um ? um[1] : null);
  };

  const onLineChange = (idx: number, text: string) => {
    if (text.includes("\n")) {
      // вставка многострочного — разбиваем
      const parts = text.split("\n");
      const next = [...lines.slice(0, idx), ...parts, ...lines.slice(idx + 1)];
      commitLines(next, idx + parts.length - 1, parts[parts.length - 1].length);
      return;
    }
    const next = [...lines];
    next[idx] = text;
    onChange(next.join("\n"));
    const el = areaRef.current;
    if (el) {
      autoGrow(el);
      trackQueries(next.join("\n"), lineStart(idx) + (el.selectionStart ?? text.length));
    }
  };

  const onLineKey = (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if ((e.nativeEvent as KeyboardEvent & { isComposing?: boolean }).isComposing) return;
    // навигация по открытому меню: вниз/вверх/enter
    const ctl = plusQuery !== null ? plusCtl.current : userQuery !== null ? userCtl.current : null;
    const menuOpen = plusQuery !== null || userQuery !== null;
    if (e.key === "ArrowDown" && ctl && menuOpen) {
      e.preventDefault();
      ctl.move(1);
      return;
    }
    if (e.key === "ArrowUp" && ctl && menuOpen) {
      e.preventDefault();
      if (ctl.peek() === 0) {
        // на первом пункте вверх — закрыть как Esc
        setPlusQuery(null);
        setUserQuery(null);
      } else {
        ctl.move(-1);
      }
      return;
    }
    if (e.key === "Enter" && ctl && menuOpen && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (ctl.count() > 0 && ctl.enter()) {
        e.preventDefault();
        return;
      }
      // пустое меню — обычный перенос строки
    }
    if (e.key === "Escape") { setPlusQuery(null); setUserQuery(null); el.blur(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); wrapSelection("**", "**"); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") { e.preventDefault(); wrapSelection("*", "*"); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); wrapSelection("[", "](https://)"); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setPlusQuery(null);
      setUserQuery(null);
      const cur = lines[idx] ?? "";
      commitLines([...lines.slice(0, idx), cur.slice(0, pos), cur.slice(end), ...lines.slice(idx + 1)], idx + 1, 0);
      return;
    }
    if (e.key === "Backspace" && pos === 0 && end === 0 && idx > 0) {
      e.preventDefault();
      setPlusQuery(null);
      setUserQuery(null);
      const prevLen = lines[idx - 1].length;
      commitLines([...lines.slice(0, idx - 1), lines[idx - 1] + lines[idx], ...lines.slice(idx + 1)], idx - 1, prevLen);
      return;
    }
    if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      setPlusQuery(null);
      setUserQuery(null);
      focusActive(idx - 1, Math.min(pos, lines[idx - 1].length));
      return;
    }
    if (e.key === "ArrowDown" && idx < lines.length - 1) {
      e.preventDefault();
      setPlusQuery(null);
      setUserQuery(null);
      focusActive(idx + 1, Math.min(pos, lines[idx + 1].length));
    }
  };

  const wrapSelection = (before: string, after = "") => {
    if (active === null) return;
    const el = areaRef.current;
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const epos = el.selectionEnd ?? 0;
    const cur = lines[active] ?? "";
    const sel = cur.slice(s, epos) || "текст";
    const next = [...lines];
    next[active] = cur.slice(0, s) + before + sel + after + cur.slice(epos);
    commitLines(next, active, s + before.length + sel.length + after.length);
  };

  const wrap = (before: string, after = "") => {
    if (active === null) {
      focusActive(lines.length - 1, lines[lines.length - 1].length);
      return;
    }
    wrapSelection(before, after);
  };

  const insertToken = (token: string) => {
    const el = areaRef.current;
    const idx = active ?? lines.length - 1;
    if (active === null) focusActive(idx);
    const cur = lines[idx] ?? "";
    const pos = el && active !== null ? (el.selectionStart ?? cur.length) : cur.length;
    const next = [...lines];
    next[idx] = cur.slice(0, pos) + token + cur.slice(pos);
    commitLines(next, idx, pos + token.length);
  };

  const pickPlace = async (p: { id: number; name: string; lat: number; lng: number; address?: string | null; district?: string | null; street?: string | null }) => {
    let pid = p.id;
    if (pid === 0) {
      const { createGeoPlace } = await import("@/lib/v5");
      const saved = await createGeoPlace({
        name: p.name, latitude: p.lat, longitude: p.lng,
        address: p.address, district: p.district, street: p.street,
      });
      pid = saved.id;
    }
    const idx = active ?? lines.length - 1;
    const cur = lines[idx] ?? "";
    const el = areaRef.current;
    const pos = el && active !== null ? (el.selectionStart ?? cur.length) : cur.length;
    const next = [...lines];
    next[idx] = (cur.slice(0, pos).replace(/\+[а-яА-ЯёЁa-zA-Z0-9 ]*$/, "") + `+[${pid}:${p.name}] ` + cur.slice(pos));
    commitLines(next, idx, undefined);
    setPlusQuery(null);
  };

  const pickUser = (u: { id: number; username: string }) => {
    const idx = active ?? lines.length - 1;
    const cur = lines[idx] ?? "";
    const el = areaRef.current;
    const pos = el && active !== null ? (el.selectionStart ?? cur.length) : cur.length;
    const next = [...lines];
    next[idx] = (cur.slice(0, pos).replace(/@([а-яА-ЯёЁa-zA-Z0-9_]*)$/, `@${u.username} `) + cur.slice(pos));
    commitLines(next, idx, undefined);
    setUserQuery(null);
  };

  return (
    <div ref={boxRef} className="relative overflow-visible rounded-xl border border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-800 [&>button]:shrink-0">
        <button type="button" title="Жирный (Ctrl+B)" onClick={() => wrap("**", "**")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><Bold className="h-4 w-4" /></button>
        <button type="button" title="Курсив (Ctrl+I)" onClick={() => wrap("*", "*")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><Italic className="h-4 w-4" /></button>
        {!compact && (
          <>
            <button type="button" title="Цитата" onClick={() => wrap("> ")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><Quote className="h-4 w-4" /></button>
            <button type="button" title="Список" onClick={() => wrap("- ")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><List className="h-4 w-4" /></button>
            <button type="button" title="Ссылка (Ctrl+K)" onClick={() => wrap("[", "](https://)")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><Link2 className="h-4 w-4" /></button>
          </>
        )}
        <button type="button" title="Упомянуть человека" onClick={() => insertToken("@")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><AtSign className="h-4 w-4" /></button>
        <button type="button" title="Прикрепить место" onClick={() => insertToken("+")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><MapPin className="h-4 w-4" /></button>
        <button type="button" title="Тег" onClick={() => insertToken("#")} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700"><Hash className="h-4 w-4" /></button>
        <button type="button" title={copied ? "Скопировано" : "Скопировать весь текст"} onClick={copyAll} className="rounded p-2 hover:bg-slate-200 dark:hover:bg-neutral-700">
          {copied ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
        <div className="ml-auto flex shrink-0 items-center px-1 text-[11px] text-slate-400 dark:text-neutral-500">
          поддерживается markdown
        </div>
      </div>
      <div className="px-3 py-2">
        {lines.length === 1 && lines[0] === "" && safeActive === null ? (
          <div
            onClick={() => focusActive(0, 0)}
            className="cursor-text text-[15px] leading-6 text-slate-400 dark:text-neutral-500"
          >
            {placeholder ?? "О чем хотите спросить? @ — человек, + — место, # — тема"}
          </div>
        ) : (
          lines.map((line, i) =>
            i === safeActive ? (
              <textarea
                key={i}
                ref={areaRef}
                value={line}
                rows={1}
                onChange={(e) => onLineChange(i, e.target.value)}
                onKeyDown={(e) => onLineKey(i, e)}
                onBlur={(e) => {
                  if (!boxRef.current?.contains(e.relatedTarget as Node)) {
                    setActive(null);
                    setPlusQuery(null);
                    setUserQuery(null);
                  }
                }}
                className="block w-full resize-none overflow-hidden bg-transparent text-[15px] leading-6 outline-none placeholder:text-slate-400 dark:placeholder:text-neutral-500"
              />
            ) : (
              <div
                key={i}
                onMouseDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY }; }}
                onClick={(e) => {
                  const d = downRef.current;
                  downRef.current = null;
                  // если тянули выделение — не переключаться в редактирование
                  if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
                  focusActive(i);
                }}
                className="cursor-text select-text text-[15px] leading-6"
                dangerouslySetInnerHTML={{ __html: renderLine(line) }}
              />
            )
          )
        )}
      </div>
      {plusQuery !== null && safeActive !== null && (
        <PlaceSuggest query={plusQuery} onClose={() => setPlusQuery(null)} onPick={pickPlace} ctlRef={plusCtl} />
      )}
      {userQuery !== null && safeActive !== null && (
        <UserSuggest query={userQuery} onClose={() => setUserQuery(null)} onPick={pickUser} ctlRef={userCtl} />
      )}
    </div>
  );
}
