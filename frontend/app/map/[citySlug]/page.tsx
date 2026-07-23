import Link from "next/link";
import { api } from "@/lib/api";
import MapView from "@/components/Map/MapView";
import type { City, Category, Place } from "@/types";

async function getCity(slug: string): Promise<City | null> {
    try {
        const res = await api.get(`/cities/${slug}`);
        return res.data;
    } catch {
        return null;
    }
}

async function getCategories(): Promise<Category[]> {
    try {
        const res = await api.get("/categories");
        return res.data;
    } catch {
        return [];
    }
}

async function getPlaces(
    citySlug: string,
    category?: string,
): Promise<Place[]> {
    try {
        const res = await api.get("/places", {
            params: { city: citySlug, category },
        });
        return res.data;
    } catch {
        return [];
    }
}

export default async function CityMapPage({
    params,
    searchParams,
}: {
    params: Promise<{ citySlug: string }>;
    searchParams: Promise<{ category?: string }>;
}) {
    const { citySlug } = await params;
    const { category } = await searchParams;

    const [city, categories] = await Promise.all([
        getCity(citySlug),
        getCategories(),
    ]);

    if (!city) {
        return (
            <main className="flex h-screen flex-col items-center justify-center gap-4 bg-black text-white">
                <p className="text-xl">Этот город не найден...</p>
                <Link href="/" className="underline">
                    На главную
                </Link>
            </main>
        );
    }

    const places = await getPlaces(citySlug, category);

    return (
        <main className="flex h-screen flex-col bg-black text-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-lime-400 px-4 py-3">
                <h1 className="text-lg font-bold tracking-wide">
                    Закоулки · {city.name}
                </h1>

                <nav className="flex flex-1 gap-2 overflow-x-auto">
                    <Link
                        href={`/map/${citySlug}`}
                        className={`shrink-0 border-2 px-3 py-1 text-xs uppercase ${
                            !category
                                ? "border-lime-400 bg-lime-400 text-black"
                                : "border-white/40"
                        }`}
                    >
                        Все
                    </Link>
                    {categories.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/map/${citySlug}?category=${cat.slug}`}
                            className={`shrink-0 border-2 px-3 py-1 text-xs uppercase ${
                                category === cat.slug
                                    ? "border-lime-400 bg-lime-400 text-black"
                                    : "border-white/40"
                            }`}
                        >
                            {cat.name}
                        </Link>
                    ))}
                </nav>

                <Link
                    href="/create/place"
                    className="shrink-0 border-2 border-lime-400 px-3 py-1 text-xs font-bold uppercase text-lime-400"
                >
                    + Добавить место
                </Link>
            </header>

            <div className="relative flex-1">
                <MapView city={city} places={places} />
            </div>
        </main>
    );
}
