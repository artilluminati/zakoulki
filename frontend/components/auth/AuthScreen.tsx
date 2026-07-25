"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import AuthPanel from "@/components/desktop/AuthPanel";

export default function AuthScreen({ mode }: { mode: "login" | "register" }) {
    const router = useRouter();

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-lime-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />

            <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                <Link
                    href="/"
                    className="mb-6 flex items-center justify-center gap-2 text-white/70 hover:text-white"
                >
                    <Compass className="h-6 w-6 text-lime-400" />
                    <span className="font-bold">Закоулки</span>
                </Link>

                <div className="rounded-xl bg-white p-4 text-black">
                    <AuthPanel
                        initialMode={mode}
                        onSuccess={() => router.push("/profile")}
                    />
                </div>

                <p className="mt-4 text-center text-xs text-white/40">
                    {mode === "login" ? (
                        <>
                            Нет аккаунта?{" "}
                            <Link
                                href="/register"
                                className="text-lime-400 hover:underline"
                            >
                                Зарегистрироваться
                            </Link>
                        </>
                    ) : (
                        <>
                            Уже есть аккаунт?{" "}
                            <Link
                                href="/login"
                                className="text-lime-400 hover:underline"
                            >
                                Войти
                            </Link>
                        </>
                    )}
                </p>
            </div>
        </main>
    );
}
