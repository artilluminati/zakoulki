"use client";
/* eslint-disable react-hooks/set-state-in-effect -- загрузка раздела, питань и модераторов */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { fetchThread, fetchAttached, createThread, uploadThreadPhoto, attachHub, renameHub, fetchHubModerators, addHubModerator, removeHubModerator, bookmarkThread, type HubModerator } from "@/lib/v5";
import ThreadCard, { timeAgo, regionLine, HubAuthorBadge, HubModeratorBadge } from "@/components/ThreadCard";
import QuickComposer from "@/components/QuickComposer";
import PhotoImg from "@/components/PhotoImg";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { ThreadV5 } from "@/types/v5";

export default function HubPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [t, setT] = useState<(ThreadV5 & { talk_id?: number | null; attached_count?: number; moderators?: { id: number; username: string }[] }) | null>(null);
  const [attached, setAttached] = useState<ThreadV5[]>([]);
  const [attSort, setAttSort] = useState<"new" | "top">("new");
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [mods, setMods] = useState<HubModerator[]>([]);
  const [modName, setModName] = useState("");
  const [bookmarked, setBookmarked] = useState(false);

  const load = useCallback(async () => {
    try {
      const h = await fetchThread(id);
      if (!(h as ThreadV5).is_hub) { router.replace(`/thread/${id}`); return; }
      setT(h as ThreadV5);
      setAttached(await fetchAttached(Number(id)).catch(() => []));
      setMods(await fetchHubModerators(Number(id)).catch(() => []));
    } catch { setT(null); }
    setLoading(false);
  }, [id, router]);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4">
        <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
        <div className="h-24 animate-pulse rounded-2xl bg-white dark:bg-neutral-900" />
      </div>
    );
  }
  if (!t) {
    return <div className="mx-auto max-w-2xl px-3 pt-10 text-center">Раздел не найден. <Link href="/hubs" className="underline">Все разделы</Link></div>;
  }

  const isAuthor = !!user && user.id === t.author_id;
  const isMod = !!user && (isAuthor || user.role === "admin" || mods.some((m) => m.id === user.id));
  const sorted = [...attached].sort((a, b) => attSort === "top" ? (b.comments_count - a.comments_count || b.id - a.id) : b.id - a.id);

  const saveTitle = async () => {
    if (titleDraft.trim().length < 2) return;
    try {
      const u = await renameHub(t.id, titleDraft.trim());
      setT({ ...t, title: u.title });
      setEditingTitle(false);
      toast("Название обновлено", "success");
    } catch { toast("Не сохранилось", "error"); }
  };

  const postToHub = async (body: string, files: File[]) => {
    if (!t.place) return;
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
      load();
    } catch {
      toast("Не опубликовалось — попробуйте ещё раз", "error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pt-4 md:px-0 md:pt-6">
      <Link href="/hubs" className="text-sm text-slate-400 dark:text-neutral-500">← Разделы</Link>

      {/* шапка раздела */}
      <article className="rounded-2xl border border-emerald-300 bg-emerald-50/50 p-4 shadow-sm md:p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
          <span>Раздел #{t.id} · @{t.author_username} · {timeAgo(t.created_at)}{regionLine(t) ? ` · ${regionLine(t)}` : ""}</span>
          <HubAuthorBadge />
        </div>
        {editingTitle ? (
          <div className="mt-2 flex gap-2">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={150}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-bold outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button onClick={saveTitle} className="shrink-0 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Ок</button>
            <button onClick={() => setEditingTitle(false)} className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm dark:border-neutral-700"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <h1 className="mt-1 flex items-center gap-2 text-xl font-extrabold leading-tight dark:text-neutral-100">
            <span className="min-w-0 flex-1">{t.title || "Раздел"}</span>
            {(isAuthor || user?.role === "admin") && (
              <button
                onClick={() => { setTitleDraft(t.title ?? ""); setEditingTitle(true); }}
                aria-label="Переименовать раздел"
                className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </h1>
        )}
        {t.place && (
          <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200/60 dark:border-emerald-800">
            {t.place.map_preview && <PhotoImg src={t.place.map_preview} className="h-28 w-full" />}
            <div className="flex items-center gap-2 bg-white/60 px-3 py-2 text-sm font-bold text-emerald-800 dark:bg-neutral-900/60 dark:text-emerald-300">
              <MapPin className="h-4 w-4" /> {t.place.name}
            </div>
            <Link href={`/map?place=${t.place.id}`} className="block bg-white/40 px-3 py-1.5 text-[13px] font-bold text-emerald-700 dark:text-emerald-300">Открыть на карте →</Link>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          {t.talk_id && (
            <Link href={`/thread/${t.talk_id}`} className="font-bold text-emerald-700 hover:underline dark:text-emerald-300">
              Общее обсуждение →
            </Link>
          )}
          <button
            onClick={async () => {
              if (!user) { toast("Войдите, чтобы сохранять", "error"); return; }
              try {
                const r = await bookmarkThread(t.id);
                setBookmarked(r.bookmarked);
                toast(r.bookmarked ? "Раздел в закладках" : "Убрано из закладок", "info");
              } catch { toast("Не получилось", "error"); }
            }}
            className={`ml-auto font-bold ${bookmarked ? "text-emerald-600" : "text-slate-500 hover:text-slate-800 dark:text-neutral-400"}`}
          >
            {bookmarked ? "★ В закладках" : "☆ В закладки"}
          </button>
        </div>
        {/* модераторы */}
        {(mods.length > 0 || isAuthor || user?.role === "admin") && (
          <div className="mt-3 rounded-xl bg-white/60 p-2.5 text-[13px] dark:bg-neutral-900/60">
            <div className="font-bold text-slate-600 dark:text-neutral-300">Модераторы</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">@{t.author_username} · автор</span>
              {mods.map((m) => (
                <span key={m.id} className="flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  @{m.username}
                  {(isAuthor || user?.role === "admin") && (
                    <button
                      aria-label="Снять модератора"
                      onClick={async () => {
                        try { setMods(await removeHubModerator(t.id, m.id)); }
                        catch { toast("Не получилось", "error"); }
                      }}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {(isAuthor || user?.role === "admin") && (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={modName}
                  onChange={(e) => setModName(e.target.value)}
                  placeholder="Ник жителя…"
                  maxLength={50}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <button
                  onClick={async () => {
                    if (modName.trim().length < 1) return;
                    try {
                      setMods(await addHubModerator(t.id, modName.trim()));
                      setModName("");
                      toast("Модератор добавлен", "success");
                    } catch {
                      toast("Не нашли такого жителя", "error");
                    }
                  }}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </article>

      {/* быстрый вопрос в раздел */}
      {user ? (
        <QuickComposer expandHref={`/create?hub=${t.id}`} onSubmit={postToHub} />
      ) : (
        <Link href="/login" className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500 dark:bg-neutral-900 dark:text-neutral-400">
          Войдите, чтобы спросить в разделе →
        </Link>
      )}

      {/* подвопросы */}
      <div className="flex items-center gap-1.5">
        <h2 className="text-[15px] font-extrabold dark:text-neutral-100">Вопросы · {attached.length}</h2>
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
      {attached.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
          Пока тихо — задайте первый вопрос выше.
        </div>
      ) : (
        <div className="space-y-3">
          {[...attached].sort((a, b) => attSort === "top" ? (b.comments_count - a.comments_count || b.id - a.id) : b.id - a.id).map((a) => (
            <ThreadCard key={a.id} t={a} hubAuthorId={t.author_id} hubModIds={mods.map((m) => m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
