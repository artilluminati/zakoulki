"use client";
/* eslint-disable react-hooks/set-state-in-effect -- превью выбранных фото */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, X } from "lucide-react";
import MdEditor from "@/components/editor/MdEditor";
import PasteButton from "@/components/PasteButton";
import { useToast } from "@/lib/toast";

/** Быстрый вопрос: текст + фото + публикация. Лента и страница раздела. */
export default function QuickComposer({ placeholder, expandHref, onSubmit }: {
  placeholder?: string;
  expandHref?: string;
  onSubmit: (body: string, files: File[]) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setThumbs(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const post = async () => {
    if ((!draft.trim() && files.length === 0) || posting) return;
    setPosting(true);
    try {
      await onSubmit(draft, files);
      setDraft("");
      setFiles([]);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      onPaste={(e) => {
        const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (imgs.length > 0) {
          e.preventDefault();
          setFiles((prev) => [...prev, ...imgs]);
          toast(`Фото добавлено: ${imgs.length}`, "success");
        }
      }}
    >
      <MdEditor value={draft} onChange={setDraft} compact placeholder={placeholder ?? "О чем хотите спросить? @ — человек, + — место"} />
      {files.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {thumbs.map((src, i) => (
            <span key={`${files[i]?.name}-${files[i]?.size}-${i}`} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-20 w-full object-contain" />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                aria-label="Убрать фото"
                className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-neutral-500">{draft.length}/5000 {draft.length > 280 ? "· вопрос" : "· оффтоп"}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} title="Прикрепить фото" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
            <ImagePlus className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file" accept="image/*" multiple className="hidden" tabIndex={-1}
            onChange={(e) => {
              setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <PasteButton iconOnly onPaste={(imgs) => { setFiles((prev) => [...prev, ...imgs]); toast(`Фото добавлено: ${imgs.length}`, "success"); }} />
          {expandHref && <Link href={expandHref} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-neutral-700">Расширить</Link>}
          <button onClick={post} disabled={(!draft.trim() && files.length === 0) || posting} className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-extrabold text-slate-900 disabled:opacity-40 hover:bg-lime-300">
            {posting ? "…" : "Опубликовать"}
          </button>
        </div>
      </div>
    </div>
  );
}
