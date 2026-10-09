"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Map as MapIcon, PlusCircle, User, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

function BellButton() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: string | number; kind: string; thread_id?: number | null; comment_id?: number | null }[]>([]);

  useEffect(() => {
    if (!user) return;
    api.get("/threads/notifications/mine").then((r) => {
      setItems(r.data ?? []);
      setCount((r.data ?? []).length);
    }).catch(() => {});
  }, [user]);

  if (!user) return null;
  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); setCount(0); }} aria-label="Уведомления" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
        <Bell className="h-5 w-5 text-slate-600" />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2 text-[13px] font-bold">Уведомления</div>
          {items.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-slate-400">Пока тихо</div>}
          {items.map((n) => (
            <Link key={String(n.id)} href={n.thread_id ? `/thread/${n.thread_id}${n.comment_id ? `#comment-${n.comment_id}` : ""}` : "/"} className="block px-3 py-2 text-sm hover:bg-slate-50">
              {n.kind === "mention" ? "Вас упомянули" : "Ответ в вашем треде"} {n.thread_id ? `#${n.thread_id}` : ""}
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
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const item = (href: string, label: string, Icon: typeof Home) => (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-medium transition ${
        isActive(href) ? "bg-lime-300/60 text-slate-900" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen">
      {/* desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-slate-200/70 bg-white/85 backdrop-blur md:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400 text-slate-900">З</span>
            Закоулки
          </Link>
          <form action="/" className="mx-auto hidden max-w-md flex-1 items-center md:flex">
            <input
              name="search"
              placeholder="Поиск по вопросам и местам"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 px-4 text-sm outline-none focus:border-lime-500 focus:bg-white"
            />
          </form>
          <Link href="/create" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Спросить
          </Link>
          <BellButton />
          <Link href={user ? "/profile" : "/login"} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <User className="h-5 w-5 text-slate-600" />
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-0 md:px-4">
        {/* desktop sidebar */}
        <aside className="sticky top-[72px] hidden h-fit w-60 shrink-0 flex-col gap-1 pt-6 md:flex">
          {item("/", "Главная", Home)}
          {item("/map", "Карта", MapIcon)}
          {item("/create", "Создать", PlusCircle)}
          {item(user ? "/profile" : "/login", "Профиль", User)}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-500">
            Спрашивайте о городе: от ямы во дворе до судьбы парка — вопросы с местом видны на карте.
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-12">{children}</main>
      </div>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {[
            { href: "/", label: "Главная", Icon: Home },
            { href: "/map", label: "Карта", Icon: MapIcon },
            { href: "/create", label: "Создать", Icon: PlusCircle },
            { href: user ? "/profile" : "/login", label: "Профиль", Icon: User },
          ].map(({ href, label, Icon }) => (
            <Link key={href + label} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive(href) ? "text-lime-700" : "text-slate-500"}`}>
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
