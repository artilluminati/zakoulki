"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка треда с сервера */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MapPin, Heart, Eye, Flag } from "lucide-react";
import { fetchThread, commentThread, likeThread, reportThread, deleteComment } from "@/lib/v5";
import { ThreadHtml, timeAgo } from "@/components/ThreadCard";
import MdEditor from "@/components/editor/MdEditor";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [t, setT] = useState<Awaited<ReturnType<typeof fetchThread>> | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setT(await fetchThread(id)); } catch { setT(null); }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;
    await commentThread(Number(id), reply);
    setReply("");
    load();
  };

  if (loading) return <div className="mx-auto max-w-2xl space-y-3 px-3 pt-6"><div className="h-48 animate-pulse rounded-2xl bg-white" /><div className="h-24 animate-pulse rounded-2xl bg-white" /></div>;
  if (!t) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Тред не найден. <Link href="/" className="underline">В ленту</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <Link href="/" className="text-sm text-slate-400">← Лента</Link>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        {t.title && <h1 className="text-xl font-extrabold leading-tight">{t.title}</h1>}
        <div className="mt-1 text-xs text-slate-500">#{t.id} · {t.author_username} · {timeAgo(t.created_at)}</div>
        <div className="mt-3"><ThreadHtml html={t.body_html} placePreview={t.place ? { [t.place.id]: t.place } : {}} /></div>
        {t.photos && t.photos.length > 0 && (
          <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${t.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {t.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" loading="lazy" onClick={() => setLightbox(p.url)} className="h-56 w-full cursor-zoom-in object-cover" />
            ))}
          </div>
        )}
        {lightbox && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setLightbox(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
          </div>
        )}
        {t.place && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              <MapPin className="h-4 w-4" /> {t.place.name}
            </div>
            <div className="px-3 py-1.5 text-xs text-slate-500">{[t.place.address, t.place.district].filter(Boolean).join(" · ")}</div>
            <Link href={`/map?place=${t.place.id}`} className="block bg-slate-50 px-3 py-2 text-[13px] font-bold text-emerald-700">Открыть на карте →</Link>
          </div>
        )}
        <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2.5 text-[13px] text-slate-500">
          <button onClick={() => likeThread(t.id).then(load)} className="flex items-center gap-1.5 hover:text-slate-800"><Heart className="h-4 w-4" /> {t.likes_count}</button>
          <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> {t.views}</span>
          <button onClick={() => reportThread(t.id, "spam").then(() => toast("Жалоба отправлена", "success")).catch(() => toast("Не отправилось", "error"))} className="ml-auto flex items-center gap-1 text-slate-400 hover:text-red-500"><Flag className="h-4 w-4" /> Жалоба</button>
        </div>
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-extrabold">Ответы · {t.comments?.length ?? 0}</h2>
        <div className="mt-2 space-y-2">
          {(t.comments ?? []).map((c) => (
            <div key={c.id} id={`comment-${c.id}`} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>#{c.id} · {timeAgo(c.created_at)}</span>
                {(user && (user.id === c.author_id || user.role === "admin")) && (
                  <button
                    onClick={async () => { await deleteComment(c.id); load(); }}
                    className="ml-auto hover:text-red-500"
                  >
                    Удалить
                  </button>
                )}
              </div>
              <div className="mt-0.5"><ThreadHtml html={c.body_html} /></div>
            </div>
          ))}
          {(t.comments ?? []).length === 0 && <p className="text-sm text-slate-400">Пока нет ответов — станьте первым.</p>}
        </div>
        {user ? (
          <div className="mt-3">
            <MdEditor value={reply} onChange={setReply} compact placeholder="Написать ответ… @ + #" />
            <button onClick={send} disabled={!reply.trim()} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Ответить</button>
          </div>
        ) : (
          <Link href="/login" className="mt-3 block rounded-xl bg-slate-100 p-3 text-center text-sm">Войдите, чтобы ответить →</Link>
        )}
      </section>
    </div>
  );
}
