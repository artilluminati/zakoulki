"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

/** Фото с зарезервированным местом: шиммер + иконка пока грузится, плавное появление. */
export default function PhotoImg({ src, alt = "", className = "", fit = "cover", onClick }: {
  src: string;
  alt?: string;
  className?: string;
  fit?: "cover" | "contain";
  onClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span className={`relative block overflow-hidden bg-slate-100 ${className}`}>
      {!loaded && !failed && (
        <span className="absolute inset-0 flex animate-pulse items-center justify-center bg-slate-100">
          <ImageIcon className="h-6 w-6 text-slate-300" />
        </span>
      )}
      {failed ? (
        <span className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-1 bg-slate-100 p-4 text-xs text-slate-400">
          <ImageIcon className="h-6 w-6 text-slate-300" />
          Фото не загрузилось
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onClick={onClick}
          className={`h-full w-full transition-opacity duration-300 ${fit === "cover" ? "object-cover" : "object-contain"} ${loaded ? "opacity-100" : "opacity-0"} ${onClick ? "cursor-zoom-in" : ""}`}
        />
      )}
    </span>
  );
}
