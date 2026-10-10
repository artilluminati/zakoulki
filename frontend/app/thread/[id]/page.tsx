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
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    try { setT(await fetchThread(id)); } catch { setT(null); }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // подсветка коммента из уведомления (#comment-123)
  useEffect(() => {
    if (loading) return;
    const h = window.location.hash;
    if (!h.startsWith("#comment-")) return;
    const el = document.querySelector(h);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("ring-2", "ring-lime-400");
      setTimeout(() => el.classList.remove("ring-2", "ring-lime-400"), 2500);
    }
  }, [loading, t]);

  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await commentThread(Number(id), reply);
      setReply("");
      toast("Ответ опубликован", "success");
      load();
    } catch {
      toast("Не опубликовалось — попробуйте ещё раз", "error");
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (cid: number) => {
    if (!window.confirm("Удалить комментарий?")) return;
    try { await deleteComment(cid); load(); }
    catch { toast("Не удалилось", "error"); }
  };

  const sendReport = async (reason: string) => {
    setReportOpen(false);
    try { await reportThread(t!.id, reason); toast("Жалоба отправлена", "success"); }
    catch { toast("Не отправилось", "error"); }
  };

  if (loading) return <div className="mx-auto max-w-2xl space-y-3 px-3 pt-6"><div className="h-48 animate-pulse rounded-2xl bg-white" /><div className="h-24 animate-pulse rounded-2xl bg-white" /></div>;
  if (!t) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Тред не найден. <Link href="/" className="underline">В ленту</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <Link href="/" className="text-sm text-slate-400">← Лента</Link>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        {t.title && <h1 className="text-xl font-extrabold leading-tight">{t.title}</h1>}
        <div className="mt-1 text-xs text-slate-500">
          #{t.id} · <Link href={t.author_username ? `/user/${t.author_username}` : "#"} className="font-semibold hover:underline">{t.author_username}</Link> · {timeAgo(t.created_at)}
        </div>
        {t.tags && t.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.tags.map((tag) => (
              <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                {tag}
              </Link>
            ))}
          </div>
        )}
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
          <button onClick={() => likeThread(t.id).then(load).catch(() => toast("Не получилось", "error"))} className="flex items-center gap-1.5 hover:text-slate-800"><Heart className="h-4 w-4" /> {t.likes_count}</button>
          <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> {t.views}</span>
          <span className="relative ml-auto">
            <button onClick={() => setReportOpen(!reportOpen)} className="flex items-center gap-1 text-slate-400 hover:text-red-500"><Flag className="h-4 w-4" /> Жалоба</button>
            {reportOpen && (
              <span className="absolute bottom-7 right-0 z-10 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {[["spam", "Спам"], ["abuse", "Оскорбления"], ["offtopic", "Не по теме"], ["other", "Другое"]].map(([v, label]) => (
                  <button key={v} onClick={() => sendReport(v)} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                    {label}
                  </button>
                ))}
              </span>
            )}
          </span>
        </div>
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-extrabold">Ответы · {t.comments?.length ?? 0}</h2>
        <div className="mt-2 space-y-2">
          {(t.comments ?? []).map((c) => (
            <div key={c.id} id={`comment-${c.id}`} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-bold text-slate-600">{c.author_username ? `@${c.author_username}` : "кто-то"}</span>
                <span>· {timeAgo(c.created_at)}</span>
                {(user && (user.id === c.author_id || user.role === "admin")) && (
                  <button
                    onClick={() => removeComment(c.id)}
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
            <button onClick={send} disabled={!reply.trim() || sending} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              {sending ? "Отправляем…" : "Ответить"}
            </button>
          </div>
        ) : (
          <Link href="/login" className="mt-3 block rounded-xl bg-slate-100 p-3 text-center text-sm">Войдите, чтобы ответить →</Link>
        )}
      </section>
    </div>
  );
}
