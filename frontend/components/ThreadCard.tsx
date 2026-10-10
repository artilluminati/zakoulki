"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircle, Eye, Heart, Bookmark } from "lucide-react";
import type { ThreadV5 } from "@/types/v5";
import { likeThread, reportThread, bookmarkThread } from "@/lib/v5";
import { useToast } from "@/lib/toast";

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "только что";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

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
  const toast = useToast();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(t.likes_count);
  const [bookmarked, setBookmarked] = useState(false);
  const [menu, setMenu] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const onBookmark = async () => {
    setBookmarked(!bookmarked);
    toast(bookmarked ? "Убрано из закладок" : "В закладках", "info");
    try { await bookmarkThread(t.id); } catch { setBookmarked(bookmarked); }
  };

  const onLike = async () => {
    setLiked(!liked);
    setLikes((v) => (liked ? v - 1 : v + 1));
    try { await likeThread(t.id); } catch { setLiked(liked); }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/thread/${t.id}`);
      toast("Ссылка скопирована", "success");
    } catch { toast("Не скопировалось", "error"); }
    setMenu(false);
  };

  const report = async () => {
    try { await reportThread(t.id, "offtopic"); toast("Жалоба отправлена", "success"); }
    catch { toast("Не отправилось", "error"); }
    setMenu(false);
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold text-slate-700" style={{ background: avatarColor(t.author_username) }}>
          {(t.author_username ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={t.author_username ? `/user/${t.author_username}` : "#"} className="truncate text-[15px] font-bold hover:underline">{t.author_username ?? "житель"}</Link>
          <div className="text-xs text-slate-500">
            {timeAgo(t.created_at)}
            {t.is_offtop ? " · оффтоп" : " · вопрос"}
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenu(!menu)} className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100">•••</button>
          {menu && (
            <div className="absolute right-0 z-10 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <button className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={share}>
                Поделиться
              </button>
              <button className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50" onClick={report}>
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

      {t.tags && t.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {t.tags.map((tag) => (
            <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
              {tag}
            </Link>
          ))}
        </div>
      )}

      {t.photos && t.photos.length > 0 && (
        <div className={`relative mt-2 grid gap-1.5 overflow-hidden rounded-xl ${t.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {t.photos.slice(0, 4).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" loading="lazy" onClick={() => setLightbox(p.url)} className="h-40 w-full cursor-zoom-in object-cover" />
          ))}
          {t.photos.length > 4 && (
            <button onClick={() => setLightbox(t.photos![0].url)} className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-lg font-extrabold text-white">
              +{t.photos.length - 4}
            </button>
          )}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
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
        <button onClick={onBookmark} className={`ml-auto flex items-center gap-1.5 ${bookmarked ? "text-emerald-600" : "hover:text-slate-800"}`}>
          <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-emerald-600" : ""}`} />
        </button>
      </div>
    </article>
  );
}
