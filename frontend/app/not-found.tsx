import Link from "next/link";
import { MapPin } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100">
        <MapPin className="h-8 w-8 text-slate-300" />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold">Такой страницы нет</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Возможно, ссылка устарела или вопрос удален.
      </p>
      <Link href="/" className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
        На главную
      </Link>
    </main>
  );
}
