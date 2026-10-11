"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, Map as MapIcon, PlusCircle, User, Bell, Search, MapPinned, ChevronDown, MessagesSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { timeAgo } from "@/components/ThreadCard";
import { useScope, scopeLabel } from "@/lib/scope";
import { ThemeToggle } from "@/lib/theme";
import ScopePicker from "@/components/ScopePicker";

function BellButton() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string | number; kind: string; author?: string; author_id?: number; thread_id?: number | null; comment_id?: number | null; title?: string | null; snippet?: string; created_at?: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // прочитанные в хедере: вчерашнее не всплывает снова; в профиле всё видно как было
  const seenKey = user ? `zakoulki_notif_seen_${user.id}` : "";
  const getSeen = (): Set<string> => {
    try {
      const raw = seenKey ? localStorage.getItem(seenKey) : null;
      const arr = raw ? (JSON.parse(raw) as (string | number)[]) : [];
      return new Set(arr.map(String));
    } catch { return new Set(); }
  };
  const saveSeen = (ids: Set<string>) => {
    try {
      if (seenKey) localStorage.setItem(seenKey, JSON.stringify([...ids].slice(-200)));
    } catch { /* ignore */ }
  };
  const markSeen = (ids: (string | number)[]) => {
    const seen = getSeen();
    ids.forEach((id) => seen.add(String(id)));
    saveSeen(seen);
  };

  useEffect(() => {
    if (!user) return;
    api.get("/threads/notifications/mine").then((r) => {
      const data = r.data ?? [];
      const seen = getSeen();
      const fresh = data.filter((n: { id: string | number }) => !seen.has(String(n.id)));
      setItems(fresh);
      setCount(fresh.length);
    }).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // закрытие по клику вне (backdrop-blur ломает fixed, поэтому через document)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // обновляем при каждом открытии, показываем только непросмотренные
      api.get("/threads/notifications/mine").then((r) => {
        const data = r.data ?? [];
        const seen = getSeen();
        setItems(data.filter((n: { id: string | number }) => !seen.has(String(n.id))));
        setCount(0);
      }).catch(() => { /* ignore */ });
    }
  };

  const clearAll = () => {
    markSeen(items.map((n) => n.id));
    setItems([]);
    setCount(0);
  };

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button onClick={toggle} aria-label="Уведомления" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800">
        <Bell className="h-5 w-5 text-slate-600 dark:text-neutral-300" />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center border-b border-slate-100 px-3 py-2 dark:border-neutral-800">
            <span className="text-[13px] font-bold">Уведомления</span>
            {items.length > 0 && (
              <button onClick={clearAll} className="ml-auto text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-neutral-300">
                Убрать все
              </button>
            )}
          </div>
          {items.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-slate-400 dark:text-neutral-500">Пока тихо</div>}
          {items.map((n) => (
            <Link key={String(n.id)} href={n.thread_id ? `/thread/${n.thread_id}${n.comment_id ? `#comment-${n.comment_id}` : ""}` : "/"} onClick={() => markSeen([n.id])} className="block border-b border-slate-50 px-3 py-2.5 last:border-0 hover:bg-slate-50 dark:border-neutral-800 dark:hover:bg-neutral-800">
              <div className="text-sm">
                <span className="font-bold">{n.author ?? "Кто-то"}</span>
                <span className="text-slate-500 dark:text-neutral-400"> {n.kind === "mention" ? "упомянул(а) вас" : "ответил(а) в вашем треде"}</span>
              </div>
              {n.snippet && <div className="mt-0.5 truncate text-xs text-slate-400 dark:text-neutral-500">{n.snippet}</div>}
              {n.created_at && <div className="mt-0.5 text-[11px] text-slate-300 dark:text-neutral-500">{timeAgo(n.created_at)}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  const { scope, setScope } = useScope();
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // закрытие поповера региона по клику вне
  useEffect(() => {
    if (!scopeOpen) return;
    const handler = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [scopeOpen]);

  const item = (href: string, label: string, Icon: typeof Home) => (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-medium transition ${
        isActive(href) ? "bg-lime-300/60 text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-svh flex-col">
      {/* desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-slate-200/70 bg-white/85 backdrop-blur md:block dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400 text-slate-900">З</span>
            Закоулки
          </Link>
          <form action="/search" className="mx-auto hidden max-w-md flex-1 items-center md:flex">
            <input
              name="q"
              placeholder="Поиск по вопросам и местам"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 px-4 text-sm outline-none focus:border-lime-500 focus:bg-white dark:focus:bg-neutral-900 dark:border-neutral-700 dark:bg-neutral-800"
            />
          </form>
          <Link href="/create" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Спросить
          </Link>
          <div ref={scopeRef} className="relative">
            <button
              onClick={() => setScopeOpen(!scopeOpen)}
              title="Выбрать регион"
              className="flex max-w-44 items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <MapPinned className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{scopeLabel(scope)}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-neutral-500" />
            </button>
            {scopeOpen && (
              <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                <ScopePicker value={scope} onChange={setScope} />
              </div>
            )}
          </div>
          <BellButton />
          <ThemeToggle />
          <Link href={user ? "/profile" : "/login"} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800">
            <User className="h-5 w-5 text-slate-600 dark:text-neutral-300" />
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-0 md:px-4">
        {/* desktop sidebar */}
        <aside className="sticky top-[72px] hidden h-fit w-60 shrink-0 flex-col gap-1 pt-6 md:flex">
          {item("/", "Главная", Home)}
          {item("/map", "Карта", MapIcon)}
          {item("/hubs", "Разделы", MessagesSquare)}
          {item("/create", "Создать", PlusCircle)}
          {item(user ? "/profile" : "/login", "Профиль", User)}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
            Спрашивайте о городе: от ямы во дворе до судьбы парка — вопросы с местом видны на карте.
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-12">{children}</main>
      </div>

      <footer className="border-t border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-[13px] text-slate-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5 font-extrabold text-slate-700 dark:text-neutral-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime-400 text-xs text-slate-900">З</span>
            Закоулки
          </span>
          <Link href="/about" className="hover:text-slate-800">О проекте</Link>
          <Link href="/data" className="hover:text-slate-800">Источники данных</Link>
          <Link href="/map" className="hover:text-slate-800">Карта</Link>
          <span className="ml-auto">Сделано на открытых данных · OSM, Яндекс.Карты</span>
        </div>
      </footer>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-700 dark:bg-neutral-900/95">
        <div className="grid grid-cols-6">
          {[
            { href: "/", label: "Главная", Icon: Home, fab: false },
            { href: "/map", label: "Карта", Icon: MapIcon, fab: false },
            { href: "/create", label: "Создать", Icon: PlusCircle, fab: true },
            { href: "/hubs", label: "Разделы", Icon: MessagesSquare, fab: false },
            { href: "/search", label: "Поиск", Icon: Search, fab: false },
            { href: user ? "/profile" : "/login", label: "Профиль", Icon: User, fab: false },
          ].map(({ href, label, Icon, fab }) => (
            <Link key={href + label} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive(href) ? "text-lime-700 dark:text-lime-300" : "text-slate-500 dark:text-neutral-400"}`}>
              <Icon className={fab ? "h-7 w-7" : "h-6 w-6"} strokeWidth={fab ? 2.5 : 2} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
