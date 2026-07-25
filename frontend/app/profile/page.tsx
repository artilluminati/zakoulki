"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, LogOut, MapPin, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { api, photoUrl } from "@/lib/api";
import type { Place, Post } from "@/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const toast = useToast();

  const [myPlaces, setMyPlaces] = useState<Place[] | null>(null);
  const [myPosts, setMyPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    if (!user) return;
    // Специального "мои места по всем городам" эндпоинта нет — переиспользуем
    // общие списки без фильтра по городу и фильтруем на клиенте по автору.
    api
      .get("/places", { params: { limit: 200 } })
      .then((res) => setMyPlaces((res.data as Place[]).filter((p) => p.created_by === user.id)))
      .catch(() => setMyPlaces([]));
    api
      .get("/posts")
      .then((res) => setMyPosts((res.data as Post[]).filter((p) => p.author_id === user.id)))
      .catch(() => setMyPosts([]));
  }, [user]);

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white/50">
        Проверяем сессию…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 text-white">
        <Compass className="h-10 w-10 text-white/30" />
        <p>Чтобы посмотреть профиль, войдите в аккаунт.</p>
        <Link href="/login" className="rounded-lg border border-lime-400/50 bg-lime-400/10 px-4 py-2 text-lime-300 hover:bg-lime-400/20">
          Войти
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 pb-16 text-white">
      <div className="mx-auto max-w-2xl px-4 pt-8">
        <Link href="/" className="text-sm text-white/50 hover:text-lime-400">
          ← На главную
        </Link>

        <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-lime-400/20 text-2xl font-bold text-lime-300">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{user.username}</p>
            <p className="truncate text-sm text-white/50">{user.email}</p>
            <p className="mt-1 text-xs text-white/30">С нами с {formatDate(user.created_at)}</p>
          </div>
          <button
            onClick={() => {
              logout();
              toast("Вы вышли из аккаунта", "info");
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/20"
          >
            <LogOut className="h-3.5 w-3.5" />
            Выйти
          </button>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <MapPin className="h-5 w-5 text-lime-400" />
            Мои места {myPlaces && <span className="text-sm font-normal text-white/40">({myPlaces.length})</span>}
          </h2>

          {myPlaces === null && <p className="text-sm text-white/40">Загружаем…</p>}
          {myPlaces?.length === 0 && (
            <p className="text-sm text-white/40">
              Вы ещё не отметили ни одного места. Откройте карту города и нажмите «Добавить место».
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {myPlaces?.map((place) => (
              <Link
                key={place.id}
                href={`/place/${place.slug}`}
                className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:border-lime-400/40"
              >
                <div className="aspect-video w-full overflow-hidden bg-white/10">
                  {place.cover_photo ? (
                    <img
                      src={photoUrl(place.cover_photo.file_name)}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/20">
                      <MapPin className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{place.title}</p>
                  <p className="truncate text-xs text-white/40">{place.city.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <MessageSquare className="h-5 w-5 text-lime-400" />
            Мои публикации {myPosts && <span className="text-sm font-normal text-white/40">({myPosts.length})</span>}
          </h2>

          {myPosts === null && <p className="text-sm text-white/40">Загружаем…</p>}
          {myPosts?.length === 0 && <p className="text-sm text-white/40">Публикаций пока нет.</p>}

          <div className="space-y-2">
            {myPosts?.map((post) => (
              <div key={post.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{post.title}</p>
                  <span className="shrink-0 text-xs text-white/30">{formatDate(post.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-white/60">{post.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
