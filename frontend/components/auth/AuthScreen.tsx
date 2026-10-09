"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthPanel from "@/components/desktop/AuthPanel";

export default function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link href="/" className="mb-4 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-lg font-extrabold">З</span>
          <span className="text-lg font-extrabold">Закоулки</span>
        </Link>
        <h1 className="text-center text-xl font-extrabold">{mode === "login" ? "С возвращением" : "Создать аккаунт"}</h1>
        <p className="mb-4 text-center text-sm text-slate-500">
          {mode === "login" ? "Отвечайте соседям и спрашивайте город" : "Спрашивайте город за минуту"}
        </p>
        <AuthPanel initialMode={mode} onSuccess={() => router.push("/")} />
        <p className="mt-4 text-center text-[13px] text-slate-500">
          {mode === "login" ? <>Нет аккаунта? <Link href="/register" className="font-bold text-emerald-700">Зарегистрироваться</Link></> : <>Уже есть? <Link href="/login" className="font-bold text-emerald-700">Войти</Link></>}
        </p>
      </div>
    </main>
  );
}
