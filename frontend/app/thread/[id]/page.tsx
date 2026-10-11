"use client";
/* eslint-disable react-hooks/set-state-in-effect -- эффекты синхронизируют состояние с сервером/файлами */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Heart, Eye, Flag, ImagePlus, X } from "lucide-react";
import { fetchThread, commentThread, likeThread, reportThread, deleteComment, updateThread, updateComment, uploadCommentPhoto, uploadThreadPhoto, deletePhoto, requestHub, voteHub, createGeoPlace, fetchAttached, createThread, attachHub } from "@/lib/v5";
import QuickComposer from "@/components/QuickComposer";
import ThreadCard, { ThreadHtml, timeAgo, OfficialBadge, HubBadge } from "@/components/ThreadCard";
import HubSection from "@/components/HubSection";
import MiniMap from "@/components/MiniMap";
import MdEditor from "@/components/editor/MdEditor";
import PasteButton from "@/components/PasteButton";
import PhotoImg from "@/components/PhotoImg";
import PollView from "@/components/PollView";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { ThreadV5 } from "@/types/v5";

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
  const [editPhotos, setEditPhotos] = useState<{ id: number; url: string; preview_url?: string }[]>([]);
  // правка точки/территории: копия места создаётся при сохранении
  const [editPin, setEditPin] = useState<{ lat: number; lng: number } | null>(null);
  const [editVertices, setEditVertices] = useState<[number, number][]>([]);
  const [editAreaMode, setEditAreaMode] = useState(false);
  const [editMapExpanded, setEditMapExpanded] = useState(false);
  const [editView, setEditView] = useState({ lat: 55.755, lng: 37.617, nonce: 0 });
  const [editSaving, setEditSaving] = useState(false);
  const [editCommentId, setEditCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const canEdit = !!user && !!t && (user.id === t.author_id || user.role === "admin");

  const startEdit = () => {
    if (!t) return;
    setEditTitle(t.title ?? "");
    setEditBody(t.body_md);
    setEditPhotos(t.photos ?? []);
    if (t.place) {
      const hasArea = !!t.place.area && t.place.area.length >= 3;
      setEditAreaMode(hasArea);
      setEditVertices(hasArea ? [...t.place.area!] : []);
      setEditPin(hasArea ? null : { lat: t.place.lat, lng: t.place.lng });
      setEditView((v) => ({ lat: t.place!.lat, lng: t.place!.lng, nonce: v.nonce + 1 }));
    } else {
      setEditPin(null);
      setEditVertices([]);
    }
    setEditMapExpanded(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!t || !editBody.trim() || editSaving) return;
    setEditSaving(true);
    try {
      let placeId: number | null | undefined;
      if (t.place) {
        if (!editAreaMode && editPin && (editPin.lat !== t.place.lat || editPin.lng !== t.place.lng)) {
          const p = await createGeoPlace({
            name: t.place.name, latitude: editPin.lat, longitude: editPin.lng,
            address: t.place.address, district: t.place.district, street: t.place.street,
            city: t.place.city, region: t.place.region, country: t.place.country,
          });
          placeId = p.id;
        } else if (editAreaMode && editVertices.length >= 3) {
          const same = editVertices.length === (t.place.area?.length ?? -1) &&
            editVertices.every((v, i) => t.place!.area![i]?.[0] === v[0] && t.place!.area![i]?.[1] === v[1]);
          if (!same) {
            const cLat = editVertices.reduce((s, v) => s + v[0], 0) / editVertices.length;
            const cLng = editVertices.reduce((s, v) => s + v[1], 0) / editVertices.length;
            const p = await createGeoPlace({
              name: t.place.name, latitude: cLat, longitude: cLng,
              address: t.place.address, district: t.place.district, street: t.place.street,
              city: t.place.city, region: t.place.region, country: t.place.country,
              area: editVertices,
            });
            placeId = p.id;
          }
        }
      }
      await updateThread(t.id, { title: editTitle || null, body_md: editBody, ...(placeId ? { place_id: placeId } : {}) });
      toast("Сохранено", "success");
      setEditing(false);
      load();
    } catch {
      toast("Не сохранилось", "error");
    } finally {
      setEditSaving(false);
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

  // лёгкий поллинг ответов: раз в 20с, только когда вкладка видна;
  // сами не подменяем (черновик и скролл целы) — показываем пилюлю
  const [freshComments, setFreshComments] = useState(0);
  const knownRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    knownRef.current = new Set((t?.comments ?? []).map((c) => c.id));
    if (freshComments > 0) setFreshComments(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.id, loading]);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        if (document.visibilityState === "visible" && !loading) {
          const fresh = await fetchThread(id);
          if (!alive) return;
          const known = knownRef.current;
          const n = (fresh.comments ?? []).filter((c) => !known.has(c.id)).length;
          if (n > 0) setFreshComments(n);
        }
      } catch { /* ignore — следующий тик повторит */ }
      if (alive) timer = setTimeout(tick, 20000);
    };
    timer = setTimeout(tick, 20000);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loading]);

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

  // подвопросы раздела: вместо ответов — посты с фильтрами
  const [attached, setAttached] = useState<ThreadV5[]>([]);
  const [attSort, setAttSort] = useState<"new" | "top">("new");
  useEffect(() => {
    if (t?.is_hub) fetchAttached(t.id).then(setAttached).catch(() => setAttached([]));
    else setAttached([]);
  }, [t?.id, t?.is_hub]);
  const sortedAttached = [...attached].sort((a, b) =>
    attSort === "top" ? (b.comments_count - a.comments_count || b.id - a.id) : b.id - a.id);

  // быстрый вопрос прямо в раздел: создаём с местом раздела и прикрепляем
  const postToHub = async (body: string, files: File[]) => {
    if (!t?.is_hub || !t.place) return;
    try {
      const nt = await createThread({
        body_md: body, place_id: t.place.id,
        city: t.place.city ?? t.city ?? null, district: t.place.district ?? t.district ?? null,
        region: t.place.region ?? t.region ?? null, country: t.place.country ?? t.country ?? "Россия",
      });
      for (const f of files) {
        try { await uploadThreadPhoto(nt.id, f); } catch { /* ignore */ }
      }
      try { await attachHub(nt.id, t.id); } catch { /* ignore */ }
      toast("Опубликовано в разделе", "success");
      setAttached(await fetchAttached(t.id));
      load();
    } catch {
      toast("Не опубликовалось — попробуйте ещё раз", "error");
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

  if (loading) return <div className="mx-auto max-w-2xl space-y-3 px-3 pt-6"><div className="h-48 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" /><div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" /></div>;
  if (!t) return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Тред не найден. <Link href="/" className="underline">В ленту</Link></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <Link href="/" className="text-sm text-slate-400 dark:text-neutral-500">← Лента</Link>
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 dark:border-neutral-700 dark:bg-neutral-900">
        {editing ? (
          <>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={150}
              placeholder="Заголовок (необязательно)"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] outline-none focus:border-lime-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <div className="mt-2">
              <MdEditor value={editBody} onChange={setEditBody} />
            </div>
            {editPhotos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {editPhotos.map((p) => (
                  <span key={p.id} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-neutral-800">
                    <PhotoImg src={p.preview_url ?? p.url} fit="contain" className="h-24 w-full" />
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
            {t.place && (
              <div className="mt-2 rounded-xl border border-slate-200 p-2.5 dark:border-neutral-700">
                <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold">
                  <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {t.place.name}
                  <span className="ml-auto flex gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => { setEditAreaMode(false); setEditPin({ lat: t.place!.lat, lng: t.place!.lng }); }}
                      className={`rounded-lg px-2 py-1 font-bold ${!editAreaMode ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}
                    >
                      Точка
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditAreaMode(true); setEditMapExpanded(true); }}
                      className={`rounded-lg px-2 py-1 font-bold ${editAreaMode ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}
                    >
                      Территория
                    </button>
                  </span>
                </div>
                {editAreaMode && (
                  <div className="mb-1.5 text-xs text-slate-500 dark:text-neutral-400">
                    Кликайте по карте — точки соединятся. Вершину можно таскать, повторный клик убирает её.
                    {editVertices.length > 0 ? ` · Точек: ${editVertices.length}` : ""}
                  </div>
                )}
                {!editAreaMode && (
                  <div className="mb-1.5 text-xs text-slate-500 dark:text-neutral-400">
                    Перетащите метку, чтобы уточнить точку.
                  </div>
                )}
                <div className="h-44 w-full">
                  <MiniMap
                    center={editView}
                    pin={editAreaMode ? null : (editPin ?? { lat: t.place.lat, lng: t.place.lng })}
                    onMove={(la, ln) => {
                      setEditPin({ lat: la, lng: ln });
                      setEditView((v) => ({ lat: la, lng: ln, nonce: v.nonce }));
                    }}
                    areaMode={editAreaMode}
                    vertices={editVertices}
                    onVertex={(la, ln, idx) => {
                      if (!editAreaMode) return;
                      if (idx !== undefined) {
                        setEditVertices((prev) => prev.map((v, i) => (i === idx ? [la, ln] as [number, number] : v)));
                      } else if (editVertices.length < 30) {
                        setEditVertices((prev) => [...prev, [la, ln] as [number, number]]);
                      }
                    }}
                    onRemoveVertex={(i) => setEditVertices((prev) => prev.filter((_, j) => j !== i))}
                    expanded={editMapExpanded}
                    onExpandedChange={setEditMapExpanded}
                  />
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
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
              <button onClick={saveEdit} disabled={!editBody.trim() || editSaving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{editSaving ? "Сохраняем…" : "Сохранить"}</button>
              <button onClick={() => setEditing(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-neutral-700">Отмена</button>
            </div>
          </>
        ) : (
          <>
        {t.title && <h1 className="text-xl font-extrabold leading-tight">{t.title}</h1>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-neutral-400">
          <span>#{t.id} · <Link href={t.author_username ? `/user/${t.author_username}` : "#"} className="font-semibold hover:underline">{t.author_username}</Link> · {timeAgo(t.created_at)}</span>
          {t.author_badge === "official" && <OfficialBadge />}
          <HubBadge t={t} />
        </div>
        {!t.is_hub && !t.is_hub_talk && t.place && user && (
          <div className="mt-2">
            {!t.hub_requested ? (
              (user.id === t.author_id || user.role === "admin") && (
                <button
                  onClick={async () => {
                    try { const u = await requestHub(t.id); setT({ ...t, ...u }); toast("Выдвинуто — жители решат голосами", "success"); }
                    catch (e: unknown) {
                      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                      toast(detail ?? "Не получилось", "error");
                    }
                  }}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[13px] font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  В раздел
                </button>
              )
            ) : (
              <button
                onClick={async () => {
                  try {
                    const u = await voteHub(t.id);
                    setT({ ...t, ...u });
                    toast(u.hub_voted ? "Голос учтён" : "Голос снят", "success");
                  } catch (e) {
                    const status = (e as { response?: { status?: number } })?.response?.status;
                    toast(status === 401 ? "Войдите, чтобы голосовать" : "Не получилось", "error");
                  }
                }}
                className={`rounded-xl border px-3 py-1.5 text-[13px] font-bold ${t.hub_voted ? "border-emerald-400 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"}`}
              >
                {t.hub_voted ? "✓ В раздел" : "В раздел"} · {t.hub_votes ?? 0}/3
              </button>
            )}
          </div>
        )}
        {t.tags && t.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.tags.map((tag) => (
              <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
                {tag}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3"><ThreadHtml html={t.body_html} placePreview={t.place ? { [t.place.id]: t.place } : {}} /></div>
        {t.poll && <PollView threadId={t.id} initial={t.poll} canVote={!!user} />}
        {t.photos && t.photos.length > 0 && (
          t.photos.length === 1 ? (
            <div className="mt-3 overflow-hidden rounded-xl">
              <PhotoImg src={t.photos[0].preview_url ?? t.photos[0].url} fit="contain" onClick={() => setLightbox(t.photos![0].url)} className="max-h-[480px] w-full" />
            </div>
          ) : (
            <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${t.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {t.photos.map((p) => (
                <PhotoImg key={p.id} src={p.preview_url ?? p.url} onClick={() => setLightbox(p.url)} className="h-56 w-full" />
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
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-700">
            {t.place.map_preview && (
              <PhotoImg src={t.place.map_preview} className="h-36 w-full" />
            )}
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <MapPin className="h-4 w-4" /> {t.place.name}
              {t.place.area && t.place.area.length >= 3 && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">территория</span>
              )}
            </div>
            <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-neutral-400">{[t.place.address, t.place.district].filter(Boolean).join(" · ")}</div>
            <Link href={`/map?place=${t.place.id}`} className="block bg-slate-50 px-3 py-2 text-[13px] font-bold text-emerald-700 dark:bg-neutral-800 dark:text-emerald-300">Открыть на карте →</Link>
          </div>
        )}
        <HubSection t={t} user={user} reload={load} />
        <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-2.5 text-[13px] text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
          <button onClick={() => likeThread(t.id).then(load).catch(() => toast("Не получилось", "error"))} className="flex items-center gap-1.5 hover:text-slate-800"><Heart className="h-4 w-4" /> {t.likes_count}</button>
          <span className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> {t.views}</span>
          {canEdit && !editing && (
            <button onClick={startEdit} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">Редактировать</button>
          )}
          {user?.role === "admin" && (
            <button onClick={adminDelete} className="font-bold text-red-600 hover:underline dark:text-red-400">Удалить</button>
          )}
          <span className="relative ml-auto">
            <button onClick={() => setReportOpen(!reportOpen)} className="flex items-center gap-1 text-slate-400 hover:text-red-500 dark:text-neutral-500"><Flag className="h-4 w-4" /> Жалоба</button>
            {reportOpen && (
              <span className="absolute bottom-7 right-0 z-10 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                {[["spam", "Спам"], ["abuse", "Оскорбления"], ["offtopic", "Не по теме"], ["other", "Другое"]].map(([v, label]) => (
                  <button key={v} onClick={() => sendReport(v)} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-neutral-200 dark:hover:bg-neutral-800">
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

      {t.is_hub && (
        <section className="space-y-3">
          {user ? (
            <QuickComposer expandHref={`/create?hub=${t.id}`} onSubmit={postToHub} />
          ) : (
            <Link href="/login" className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
              Войдите, чтобы спросить в разделе →
            </Link>
          )}
          <div className="flex items-center gap-1.5">
            <h2 className="text-[15px] font-extrabold dark:text-neutral-100">Вопросы раздела · {attached.length}</h2>
            <span className="ml-auto flex gap-1 text-xs">
              {(["new", "top"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setAttSort(s)}
                  className={`rounded-full px-2.5 py-1 font-bold ${attSort === s ? "bg-slate-900 text-white" : "text-slate-500 dark:text-neutral-400"}`}
                >
                  {s === "new" ? "Новые" : "Обсуждают"}
                </button>
              ))}
            </span>
          </div>
          {sortedAttached.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
              Пока тихо — <Link href={`/create?hub=${t.id}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">задайте первый вопрос</Link>.
            </div>
          ) : (
            sortedAttached.map((a) => <ThreadCard key={a.id} t={a} />)
          )}
        </section>
      )}

      {!t.is_hub && (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="font-extrabold">Ответы · {t.comments?.length ?? 0}</h2>
        {freshComments > 0 && (
          <button
            onClick={() => { load(); }}
            className="mt-2 w-full rounded-xl bg-lime-300 py-2 text-sm font-extrabold text-slate-900 transition hover:bg-lime-200 active:scale-[0.99]"
          >
            {freshComments} {freshComments === 1 ? "новый ответ" : freshComments < 5 ? "новых ответа" : "новых ответов"} — показать ↓
          </button>
        )}
        <div className="mt-2 space-y-2">
          {(t.comments ?? []).map((c) => (
            <div key={c.id} id={`comment-${c.id}`} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-neutral-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-neutral-500">
                <span className="font-bold text-slate-600 dark:text-neutral-300">{c.author_username ? `@${c.author_username}` : "кто-то"}</span>
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
                    <button onClick={() => setEditCommentId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-neutral-700">Отмена</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-0.5"><ThreadHtml html={c.body_html} /></div>
                  {c.photos && c.photos.length > 0 && (
                    <div className="mt-1.5 grid gap-1.5 overflow-hidden rounded-xl sm:grid-cols-2">
                      {c.photos.map((p) => (
                        <PhotoImg key={p.id} src={p.preview_url ?? p.url} fit="contain" onClick={() => setLightbox(p.url)} className="max-h-72 w-full" />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {(t.comments ?? []).length === 0 && <p className="text-sm text-slate-400 dark:text-neutral-500">Пока нет ответов — станьте первым.</p>}
        </div>
        {user ? (
          t.is_hub && !t.is_hub_talk ? (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-[13px] text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">
              Раздел не обсуждают здесь —{" "}
              {t.talk_id ? (
                <Link href={`/thread/${t.talk_id}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">
                  общее обсуждение →
                </Link>
              ) : "обсуждение пока не создано"}
            </div>
          ) : (
          <div className="mt-3" onPaste={pasteFiles}>
            <MdEditor value={reply} onChange={setReply} compact placeholder="Написать ответ… @ + #" />
            {replyFiles.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {replyThumbs.map((src, i) => (
                  <span key={`${replyFiles[i]?.name}-${replyFiles[i]?.size}-${i}`} className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-neutral-800">
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
              <button type="button" onClick={() => replyFileRef.current?.click()} title="Прикрепить фото" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
                <ImagePlus className="h-4 w-4" /> Фото
              </button>
              <input
                ref={replyFileRef}
                type="file" accept="image/*" multiple className="hidden" tabIndex={-1}
                onChange={(e) => {
                  setReplyFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <PasteButton iconOnly onPaste={(imgs) => { setReplyFiles((prev) => [...prev, ...imgs]); toast(`Фото добавлено: ${imgs.length}`, "success"); }} />
              <button onClick={send} disabled={(!reply.trim() && replyFiles.length === 0) || sending} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                {sending ? "Отправляем…" : "Ответить"}
              </button>
            </div>
          </div>
          )
        ) : (
          <Link href="/login" className="mt-3 block rounded-xl bg-slate-100 p-3 text-center text-sm dark:bg-neutral-800">Войдите, чтобы ответить →</Link>
        )}
      </section>
      )}
    </div>
  );
}
