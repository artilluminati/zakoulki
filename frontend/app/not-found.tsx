import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 text-center text-white">
      <Compass className="h-12 w-12 text-white/20" />
      <h1 className="text-2xl font-bold">Страница не найдена</h1>
      <p className="max-w-sm text-sm text-white/50">
        Похоже, вы забрели в закоулок, которого нет на карте. Возможно, ссылка устарела.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-lime-400/50 bg-lime-400/10 px-4 py-2 text-sm text-lime-300 hover:bg-lime-400/20"
      >
        На главную
      </Link>
    </main>
  );
}
