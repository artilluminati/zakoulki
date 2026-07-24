"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { api, photoUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getApiError } from "@/lib/errors";
import AuthPanel from "@/components/desktop/AuthPanel";
import type { PlaceDetail, Post } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function PlaceDetailClient({ place: initialPlace }: { place: PlaceDetail }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>(initialPlace.posts);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // --- форма новой публикации ---
  const [showForm, setShowForm] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postText, setPostText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"idle" | "post" | "photos">("idle");
  const [error, setError] = useState<string | null>(null);
  const submitting = stage !== "idle";

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.target.files ?? []));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!postText.trim()) {
      setError("Добавьте текст публикации");
      return;
    }

    try {
      setStage("post");
      const res = await api.post("/posts", {
        place_id: initialPlace.id,
        title: postTitle.trim() || initialPlace.title,
        text: postText,
      });
      const post: Post = res.data;

      if (files.length > 0) {
        setStage("photos");
        for (const file of files) {
          const formData = new FormData();
          formData.append("post_id", String(post.id));
          formData.append("file", file);
          await api.post("/photos", formData);
        }
        // подтягиваем публикацию заново, чтобы получить прикреплённые фото
        const refreshed = await api.get(`/posts/${post.id}`);
        setPosts((prev) => [refreshed.data, ...prev]);
      } else {
        setPosts((prev) => [post, ...prev]);
      }

      setPostTitle("");
      setPostText("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
    } catch (err) {
      setError(getApiError(err, "Не удалось опубликовать"));
    } finally {
      setStage("idle");
    }
  };

  const allPhotos = posts.flatMap((p) => p.photos);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 pb-16 text-white">
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 text-3xl leading-none text-white/70 hover:text-white"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 pt-8">
        <Link href={`/map/${initialPlace.city.slug}`} className="text-sm text-white/50 hover:text-lime-400">
          ← Назад на карту «{initialPlace.city.name}»
        </Link>

        <h1 className="mt-3 text-3xl font-bold">{initialPlace.title}</h1>

        {initialPlace.categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {initialPlace.categories.map((c) => (
              <span key={c.id} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                {c.name}
              </span>
            ))}
          </div>
        )}

        {allPhotos.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {allPhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setLightbox(photoUrl(photo.file_name))}
                className="aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5"
              >
                <img
                  src={photoUrl(photo.file_name)}
                  alt=""
                  className="h-full w-full object-cover transition hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-bold">Публикации</h2>
          {user ? (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg border border-lime-400/50 bg-lime-400/10 px-3 py-1.5 text-sm text-lime-300 hover:bg-lime-400/20"
            >
              {showForm ? "Отмена" : "+ Добавить публикацию"}
            </button>
          ) : null}
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <input
              className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder-white/30"
              placeholder={`Заголовок (по умолчанию: «${initialPlace.title}»)`}
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              disabled={submitting}
            />
            <textarea
              className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm placeholder-white/30"
              placeholder="Что нового про это место?"
              rows={3}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              disabled={submitting}
            />
            <label
              className={`block cursor-pointer rounded border px-3 py-2 text-center text-sm ${
                submitting ? "border-white/10 opacity-50" : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
            >
              📷 {files.length > 0 ? `Выбрано фото: ${files.length}` : "Добавить фото (необязательно)"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFiles}
                disabled={submitting}
                className="hidden"
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              disabled={submitting}
              className="self-start rounded-lg border border-lime-400/50 bg-lime-400/10 px-4 py-1.5 text-sm text-lime-300 hover:bg-lime-400/20 disabled:opacity-50"
            >
              {stage === "post" ? "Публикуем…" : stage === "photos" ? "Загружаем фото…" : "Опубликовать"}
            </button>
          </form>
        )}

        {!user && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white p-4 text-black">
            <p className="mb-2 text-sm text-black/60">Войдите, чтобы добавить публикацию к этому месту.</p>
            <AuthPanel />
          </div>
        )}

        <div className="mt-4 space-y-4">
          {posts.length === 0 && <p className="text-sm text-white/40">Публикаций пока нет.</p>}
          {posts.map((post) => (
            <article key={post.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="font-bold">{post.title}</h3>
                <span className="shrink-0 text-xs text-white/40">{formatDate(post.created_at)}</span>
              </div>
              {post.author_username && (
                <p className="mb-2 text-xs text-white/40">Автор: {post.author_username}</p>
              )}
              <p className="whitespace-pre-wrap text-sm text-white/80">{post.text}</p>

              {post.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {post.photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightbox(photoUrl(photo.file_name))}
                      className="aspect-square overflow-hidden rounded-lg border border-white/10"
                    >
                      <img
                        src={photoUrl(photo.file_name)}
                        alt=""
                        className="h-full w-full object-cover transition hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
