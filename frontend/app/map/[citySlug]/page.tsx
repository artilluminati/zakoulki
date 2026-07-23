import Link from "next/link";
import { api } from "@/lib/api";
import MapDesktop from "@/components/desktop/MapDesktop";
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

async function getPlaces(citySlug: string): Promise<Place[]> {
    try {
        // Забираем все места города разом — фильтрация по категориям происходит
        // на клиенте в окне "Категории", без повторных обращений к API.
        const res = await api.get("/places", {
            params: { city: citySlug, limit: 200 },
        });
        return res.data;
    } catch {
        return [];
    }
}

export default async function CityMapPage({
    params,
}: {
    params: Promise<{ citySlug: string }>;
}) {
    const { citySlug } = await params;
    const [city, categories] = await Promise.all([
        getCity(citySlug),
        getCategories(),
    ]);

    if (!city) {
        return (
            <main className="flex h-screen flex-col items-center justify-center gap-4 bg-black text-white">
                <p className="text-xl">Город не найден </p>
                <Link href="/" className="underline">
                    На главную
                </Link>
            </main>
        );
    }

    const places = await getPlaces(citySlug);

    return <MapDesktop city={city} categories={categories} places={places} />;
}
