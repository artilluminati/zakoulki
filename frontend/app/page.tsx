import Link from "next/link";
import { api } from "@/lib/api";
import type { City } from "@/types";

async function getCities(): Promise<City[]> {
    try {
        const res = await api.get("/cities");
        return res.data;
    } catch {
        return [];
    }
}

export default async function HomePage() {
    const cities = await getCities();

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-lime-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />

            <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400/20 text-3xl">
                        🧭
                    </div>
                    <h1 className="text-2xl font-bold text-white">Zakoulki</h1>
                    <p className="mt-1 text-sm text-white/50">
                        Увидел → Сфотографировал → Отметил на карте → Поделился
                    </p>
                </div>

                <p className="mb-3 text-xs uppercase tracking-wide text-white/40">
                    Выберите город
                </p>

                <div className="space-y-2">
                    {cities.length === 0 && (
                        <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-center text-sm text-white/50">
                            Города не загружены. Проверьте, что backend запущен
                            и выполнен сид базы (
                            <code>python -m app.db.seed</code>).
                        </p>
                    )}
                    {cities.map((city) => (
                        <Link
                            key={city.id}
                            href={`/map/${city.slug}`}
                            className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-lime-400/50 hover:bg-lime-400/10"
                        >
                            <span className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                                    {city.name.slice(0, 1)}
                                </span>
                                <span className="text-sm font-medium text-white">
                                    {city.name}
                                </span>
                            </span>
                            <span className="text-white/30 transition group-hover:translate-x-1 group-hover:text-lime-400">
                                →
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    );
}
