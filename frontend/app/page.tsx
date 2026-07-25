import Link from "next/link";
import { Compass, ArrowRight, MapPin, UserCircle2 } from "lucide-react";
import { api, photoUrl } from "@/lib/api";
import type { City, Place } from "@/types";

async function getCities(): Promise<City[]> {
    try {
        const res = await api.get("/cities");
        return res.data;
    } catch {
        return [];
    }
}

async function getRecentPlaces(): Promise<Place[]> {
    try {
        const res = await api.get("/places", { params: { limit: 6 } });
        return res.data;
    } catch {
        return [];
    }
}

export default async function HomePage() {
    const [cities, recentPlaces] = await Promise.all([getCities(), getRecentPlaces()]);

    return (
        <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 pb-16">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-lime-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 top-64 h-96 w-96 rounded-full bg-indigo-500/30 blur-3xl" />

            <nav className="relative mx-auto flex max-w-4xl items-center justify-between py-6">
                <span className="flex items-center gap-2 font-bold text-white">
                    <Compass className="h-5 w-5 text-lime-400" />
                    Закоулки
                </span>
                <Link
                    href="/profile"
                    className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
                >
                    <UserCircle2 className="h-4 w-4" />
                    Профиль
                </Link>
            </nav>

            <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-16">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400/20">
                            <Compass className="h-7 w-7 text-lime-300" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Закоулки</h1>
                        <p className="mt-1 text-sm text-white/50">
                            Карта необычных городских мест, которую наполняют сами жители:
                            стрит-арт, заброшенные объекты, скрытые дворы и другие находки.
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-wide text-white/30">
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
                                <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-lime-400" />
                            </Link>
                        ))}
                    </div>
                </div>

                {recentPlaces.length > 0 && (
                    <section className="w-full">
                        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
                            <MapPin className="h-5 w-5 text-lime-400" />
                            Последние находки
                        </h2>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {recentPlaces.map((place) => (
                                <Link
                                    key={place.id}
                                    href={`/place/${place.slug}`}
                                    className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-lime-400/40"
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
                                    <div className="p-3">
                                        <p className="truncate text-sm font-medium text-white">{place.title}</p>
                                        <p className="truncate text-xs text-white/40">{place.city.name}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}
