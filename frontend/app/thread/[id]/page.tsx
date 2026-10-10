"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты синхронизируют состояние с сервером/файлами */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Heart, Eye, Flag, ImagePlus, X } from "lucide-react";
import { fetchThread, commentThread, likeThread, reportThread, deleteComment, updateThread, updateComment, uploadCommentPhoto, uploadThreadPhoto, deletePhoto, requestImportant, voteImportant } from "@/lib/v5";
import { ThreadHtml, timeAgo, OfficialBadge, ImportantBadge } from "@/components/ThreadCard";
import MdEditor from "@/components/editor/MdEditor";
import PasteButton from "@/components/PasteButton";
import PollView from "@/components/PollView";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [t, setT] = useState<Awaited<ReturnType<typeof fetchThread>> | null>(null);
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const [replyThumbs, setReplyThumbs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPhotos, setEditPhotos] = useState<{ id: number; url: string }[]>([]);
  const [editCommentId, setEditCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const canEdit = !!user && !!t && (user.id === t.author_id || user.role === "admin");

  const startEdit = () => {
    if (!t) return;
    setEditTitle(t.title ?? "");
    setEditBody(t.body_md);
    setEditPhotos(t.photos ?? []);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!t || !editBody.trim()) return;
    try {
      await updateThread(t.id, { title: editTitle || null, body_md: editBody });
      toast("Сохранено", "success");
      setEditing(false);
      load();
    } catch {
      toast("Не сохранилось", "error");
    }
  };

  const saveCommentEdit = async (cid: number) => {
    if (!editCommentBody.trim()) return;
    try {
      await updateComment(cid, editCommentBody);
      setEditCommentId(null);
      load();
    } catch {
      toast("Не сохранилось", "error");
    }
  };

  const load = useCallback(async () => {
    try { setT(await fetchThread(id)); } catch { setT(null); }
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // превью выбранных фото ответа
  useEffect(() => {
    const urls = replyFiles.map((f) => URL.createObjectURL(f));
    setReplyThumbs(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [replyFiles]);

  const pasteFiles = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (imgs.length > 0) {
      e.preventDefault();
      setReplyFiles((prev) => [...prev, ...imgs]);
      toast(`Фото добавлено: ${imgs.length}`, "success");
    }
  };

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
    if ((!reply.trim() && replyFiles.length === 0) || sending) return;
    setSending(true);
    try {
      const c = await commentThread(Number(id), reply);
      for (const f of replyFiles) {
        try { await uploadCommentPhoto(c.id, f); } catch { /* ignore */ }
      }
      setReply("");
      setReplyFiles([]);
      toast("Ответ опубликован", "success");
      load();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast("Сессия истекла — войдите снова", "error");
        router.push("/login");
      } else {
        toast("Не опубликовалось — попробуйте ещё раз", "error");
      }
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

  const adminDelete = async () => {
    if (!t || !window.confirm(`Удалить тред #${t.id} вместе со всем содержимым?`)) return;
    try {
      await api.delete(`/admin/threads/${t.id}`);
      toast("Тред удалён", "success");
      router.push("/");
    } catch {
      toast("Не получилось", "error");
    }
  };

  if (loading) return <div className="mx-auto max-w-2xl space-y-3 px-3 pt-6"><div className="h-48 animate-pulse rounded-2xl bg-white" /><div className="h-24 animate-pulse rounded-2xl bg-white" /></div>;
  if (!t) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Тред не найден. <Link href="/" className="underline">В ленту</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <Link href="/" className="text-sm text-slate-400">← Лента</Link>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        {editing ? (
          <>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={150}
              placeholder="Заголовок (необязательно)"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-lime-500"
            />
            <div className="mt-2">
              <MdEditor value={editBody} onChange={setEditBody} />
            </div>
            {editPhotos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {editPhotos.map((p) => (
                  <span key={p.id} className="relative overflow-hidden rounded-xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-24 w-full object-contain" />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deletePhoto(p.id);
                          setEditPhotos(editPhotos.filter((x) => x.id !== p.id));
                        } catch {
                          toast("Не удалилось", "error");
                        }
                      }}
                      aria-label="Убрать фото"
                      className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <ImagePlus className="h-4 w-4" /> Добавить фото
                <input
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={async (e) => {
                    const list = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (!t || list.length === 0) return;
                    try {
                      const uploaded = await Promise.all(list.map((f) => uploadThreadPhoto(t.id, f)));
                      setEditPhotos((prev) => [...prev, ...uploaded]);
                    } catch {
                      toast("Какое-то фото не загрузилось", "error");
                    }
                  }}
                />
              </label>
              <button onClick={saveEdit} disabled={!editBody.trim()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Сохранить</button>
              <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Отмена</button>
            </div>
          </>
        ) : (
          <>
        {t.title && <h1 className="text-xl font-extrabold leading-tight">{t.title}</h1>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span>#{t.id} · <Link href={t.author_username ? `/user/${t.author_username}` : "#"} className="font-semibold hover:underline">{t.author_username}</Link> · {timeAgo(t.created_at)}</span>
          {t.author_badge === "official" && <OfficialBadge />}
          <ImportantBadge t={t} />
        </div>
        {!t.is_important && user && (
          <div className="mt-2">
            {!t.important_requested ? (
              (user.id === t.author_id || user.role === "admin") && (
                <button
                  onClick={async () => {
                    try { const u = await requestImportant(t.id); setT({ ...t, ...u }); toast("Выдвинуто — жители решат голосами", "success"); }
                    catch { toast("Не получилось", "error"); }
                  }}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-[13px] font-bold text-amber-800 hover:bg-amber-100"
                >
                  Сделать важным
                </button>
              )
            ) : (
              <button
                onClick={async () => {
                  try {
                    const u = await voteImportant(t.id);
                    setT({ ...t, ...u });
                    toast(u.important_voted ? "Голос учтён" : "Голос снят", "success");
                  } catch (e) {
                    const status = (e as { response?: { status?: number } })?.response?.status;
                    toast(status === 401 ? "Войдите, чтобы голосовать" : "Не получилось", "error");
                  }
                }}
                className={`rounded-xl border px-3 py-1.5 text-[13px] font-bold ${t.important_voted ? "border-amber-400 bg-amber-100 text-amber-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {t.important_voted ? "✓ Это важно" : "Это важно"} · {t.important_votes ?? 0}/3
              </button>
            )}
          </div>
        )}
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
        {t.poll && <PollView threadId={t.id} initial={t.poll} canVote={!!user} />}
        {t.photos && t.photos.length > 0 && (
          t.photos.length === 1 ? (
            <div className="mt-3 overflow-hidden rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.photos[0].url} alt="" loading="lazy" onClick={() => setLightbox(t.photos![0].url)} className="max-h-[480px] w-full cursor-zoom-in object-contain" />
            </div>
          ) : (
            <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${t.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {t.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.preview_url ?? p.url} alt="" loading="lazy" onClick={() => setLightbox(p.url)} className="h-56 w-full cursor-zoom-in object-cover" />
              ))}
            </div>
          )
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
          {canEdit && !editing && (
            <button onClick={startEdit} className="font-bold text-emerald-700 hover:underline">Редактировать</button>
          )}
          {user?.role === "admin" && (
            <button onClick={adminDelete} className="font-bold text-red-600 hover:underline">Удалить</button>
          )}
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
          </>
        )}
      </article>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-extrabold">Ответы · {t.comments?.length ?? 0}</h2>
        <div className="mt-2 space-y-2">
          {(t.comments ?? []).map((c) => (
            <div key={c.id} id={`comment-${c.id}`} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-bold text-slate-600">{c.author_username ? `@${c.author_username}` : "кто-то"}</span>
                {c.author_badge === "official" && <OfficialBadge />}
                <span>· {timeAgo(c.created_at)}</span>
                {(user && (user.id === c.author_id || user.role === "admin")) && (
                  <>
                    <button
                      onClick={() => { setEditCommentId(c.id); setEditCommentBody(c.body_md); }}
                      className="ml-auto hover:text-slate-700"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => removeComment(c.id)}
                      className="hover:text-red-500"
                    >
                      Удалить
                    </button>
                  </>
                )}
              </div>
              {editCommentId === c.id ? (
                <div className="mt-1.5">
                  <MdEditor value={editCommentBody} onChange={setEditCommentBody} compact />
                  <div className="mt-1.5 flex gap-2">
                    <button onClick={() => saveCommentEdit(c.id)} disabled={!editCommentBody.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Сохранить</button>
                    <button onClick={() => setEditCommentId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold">Отмена</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-0.5"><ThreadHtml html={c.body_html} /></div>
                  {c.photos && c.photos.length > 0 && (
                    <div className="mt-1.5 grid gap-1.5 overflow-hidden rounded-xl bg-slate-100 sm:grid-cols-2">
                      {c.photos.map((p) => (
                        <span key={p.id} className="relative block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.preview_url ?? p.url} alt="" loading="lazy" onClick={() => setLightbox(p.url)} className="max-h-72 w-full cursor-zoom-in object-contain" />
                          {(user && (user.id === c.author_id || user.role === "admin")) && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try { await deletePhoto(p.id); load(); }
                                catch { toast("Не удалилось", "error"); }
                              }}
                              aria-label="Убрать фото"
                              className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/70 p-1 text-white"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {(t.comments ?? []).length === 0 && <p className="text-sm text-slate-400">Пока нет ответов — станьте первым.</p>}
        </div>
        {user ? (
          <div className="mt-3" onPaste={pasteFiles}>
            <MdEditor value={reply} onChange={setReply} compact placeholder="Написать ответ… @ + #" />
            {replyFiles.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {replyThumbs.map((src, i) => (
                  <span key={`${replyFiles[i]?.name}-${replyFiles[i]?.size}-${i}`} className="relative overflow-hidden rounded-xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-20 w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setReplyFiles(replyFiles.filter((_, j) => j !== i))}
                      aria-label="Убрать фото"
                      className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => replyFileRef.current?.click()} title="Выбрать файл" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                ref={replyFileRef}
                type="file" accept="image/*" multiple className="hidden" tabIndex={-1}
                onChange={(e) => {
                  setReplyFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <PasteButton small onPaste={(imgs) => { setReplyFiles((prev) => [...prev, ...imgs]); toast(`Фото добавлено: ${imgs.length}`, "success"); }} />
              <button onClick={send} disabled={(!reply.trim() && replyFiles.length === 0) || sending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                {sending ? "Отправляем…" : "Ответить"}
              </button>
            </div>
          </div>
        ) : (
          <Link href="/login" className="mt-3 block rounded-xl bg-slate-100 p-3 text-center text-sm">Войдите, чтобы ответить →</Link>
        )}
      </section>
    </div>
  );
}
