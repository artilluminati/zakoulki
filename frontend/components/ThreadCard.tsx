"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle, Eye, Heart, Bookmark } from "lucide-react";
import type { ThreadV5 } from "@/types/v5";
import { likeThread, reportThread } from "@/lib/v5";

function avatarColor(name?: string | null) {
  let h = 0;
  for (const c of name ?? "?") h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 60% 88%)`;
}

/** Рендер body_html: заменяем <a class=place> на чип с иконкой + тултип (фото/улица·район). */
export function ThreadHtml({ html, placePreview }: { html: string; placePreview?: Record<number, { name: string; address?: string | null; district?: string | null; preview_url?: string | null }> }) {
  const [tip, setTip] = useState<number | null>(null);

  // грубо парсим чипы мест регуляркой — без dangerouslySetInnerHTML для всего
  const parts = html.split(/(<a class="place" data-place-id="\d+" href="[^"]*">.*?<\/a>)/g);
  return (
    <div className="thread-html text-[15px] leading-relaxed">
      {parts.map((p, i) => {
        const m = p.match(/data-place-id="(\d+)".*?>(.*?)<\/a>/);
        if (!m) return <span key={i} dangerouslySetInnerHTML={{ __html: p }} />;
        const id = Number(m[1]);
        const label = m[2].replace("📍", "");
        const info = placePreview?.[id];
        return (
          <span key={i} className="relative inline-block">
            <button
              type="button"
              onClick={() => setTip(tip === id ? null : id)}
              onMouseEnter={() => setTip(id)}
              onMouseLeave={() => setTip(null)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <MapPin className="h-3.5 w-3.5" />
              {label}
            </button>
            {tip === id && (
              <span className="place-tooltip">
                {info?.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.preview_url} alt="" className="h-24 w-full object-cover" />
                ) : (
                  <span className="flex h-16 items-center justify-center bg-slate-100 text-slate-400">
                    <MapPin className="h-6 w-6" />
                  </span>
                )}
                <span className="block p-2.5">
                  <span className="block text-[13px] font-bold text-slate-900">{info?.name ?? label}</span>
                  <span className="block text-xs text-slate-500">
                    {info ? ([info.address, info.district].filter(Boolean).join(" · ") || "Рядом") : "Точка на карте"}
                  </span>
                  <Link href={`/map?place=${id}`} className="mt-1 block text-xs font-semibold text-emerald-700">Открыть на карте →</Link>
                </span>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function ThreadCard({ t }: { t: ThreadV5 }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(t.likes_count);
  const [menu, setMenu] = useState(false);

  const onLike = async () => {
    setLiked(!liked);
    setLikes((v) => (liked ? v - 1 : v + 1));
    try { await likeThread(t.id); } catch { setLiked(liked); }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-slate-700" style={{ background: avatarColor(t.author_username) }}>
          {(t.author_username ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{t.author_username ?? "житель"}</div>
          <div className="text-xs text-slate-500">
            {new Date(t.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {t.is_offtop ? " · оффтоп" : " · вопрос"}
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100">•••</button>
          {menu && (
            <div className="absolute right-0 z-10 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <button
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={async () => { await navigator.clipboard.writeText(`${location.origin}/thread/${t.id}`); setMenu(false); }}
              >
                Поделиться
              </button>
              <button
                className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                onClick={async () => { await reportThread(t.id, "offtopic").catch(() => {}); setMenu(false); }}
              >
                Пожаловаться
              </button>
            </div>
          )}
        </div>
      </div>

      <Link href={`/thread/${t.id}`} className="mt-2 block">
        {t.title && <h3 className="text-[16px] font-extrabold leading-snug">{t.title}</h3>}
        <ThreadHtml html={t.body_html} placePreview={t.place ? { [t.place.id]: t.place } : {}} />
      </Link>

      {t.photos && t.photos.length > 0 && (
        <div className={`mt-2 grid gap-1.5 overflow-hidden rounded-xl ${t.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {t.photos.slice(0, 4).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" loading="lazy" className="h-40 w-full object-cover" />
          ))}
        </div>
      )}

      {t.place && (
        <Link href={`/map?place=${t.place.id}`} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100">
          <MapPin className="h-4 w-4" />
          {t.place.name}
        </Link>
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2.5 text-[13px] text-slate-500">
        <Link href={`/thread/${t.id}`} className="flex items-center gap-1.5 hover:text-slate-800">
          <MessageCircle className="h-4 w-4" /> {t.comments_count}
        </Link>
        <button onClick={onLike} className={`flex items-center gap-1.5 ${liked ? "text-red-500" : "hover:text-slate-800"}`}>
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500" : ""}`} /> {likes}
        </button>
        <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> {t.views}</span>
        <button className="ml-auto flex items-center gap-1.5 hover:text-slate-800"><Bookmark className="h-4 w-4" /> </button>
      </div>
    </article>
  );
}
