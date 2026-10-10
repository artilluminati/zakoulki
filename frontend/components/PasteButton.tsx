"use client";

import { ClipboardPaste } from "lucide-react";

/** Кнопка «Вставить из буфера»: читает картинки через Clipboard API.
 * На части мобильных браузеров чтение запрещено — тогда подсказываем выбрать файл. */
export default function PasteButton({ onPaste, small = false, iconOnly = false }: {
  onPaste: (files: File[]) => void;
  small?: boolean;
  iconOnly?: boolean;
}) {
  const read = async () => {
    try {
      const items = await navigator.clipboard.read();
      const imgs: File[] = [];
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            imgs.push(new File([blob], `clipboard.${type.split("/")[1] ?? "png"}`, { type }));
          }
        }
      }
      if (imgs.length > 0) {
        onPaste(imgs);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <button
      type="button"
      title="Вставить фото из буфера обмена"
      onClick={async () => {
        const ok = await read();
        if (!ok) {
          // fallback: пользователю проще выбрать файл вручную
          const el = document.createElement("input");
          el.type = "file";
          el.accept = "image/*";
          el.multiple = true;
          el.onchange = () => onPaste(Array.from(el.files ?? []));
          el.click();
        }
      }}
      className={iconOnly
        ? "flex items-center rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
        : small
          ? "flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          : "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-500 hover:border-emerald-400 hover:text-emerald-700"}
    >
      <ClipboardPaste className={small || iconOnly ? "h-4 w-4" : "h-5 w-5"} />
      {!iconOnly && (small ? "Из буфера" : "Вставить из буфера")}
    </button>
  );
}
