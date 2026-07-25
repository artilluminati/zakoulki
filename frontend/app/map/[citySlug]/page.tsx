import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "lucide-react";
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

async function getCities(): Promise<City[]> {
    try {
        const res = await api.get("/cities");
        return res.data;
    } catch {
        return [];
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
        // Забираем все места города разом — фильтрация по категориям/поиску/фото
        // происходит на клиенте в окне "Фильтры", без повторных обращений к API.
        const res = await api.get("/places", {
            params: { city: citySlug, limit: 200 },
        });
        return res.data;
    } catch {
        return [];
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ citySlug: string }>;
}): Promise<Metadata> {
    const { citySlug } = await params;
    const city = await getCity(citySlug);
    return { title: city ? `Карта — ${city.name}` : "Город не найден" };
}

export default async function CityMapPage({
    params,
}: {
    params: Promise<{ citySlug: string }>;
}) {
    const { citySlug } = await params;
    const [city, cities, categories] = await Promise.all([
        getCity(citySlug),
        getCities(),
        getCategories(),
    ]);

    if (!city) {
        return (
            <main className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <Compass className="h-10 w-10 text-white/30" />
                <p className="text-xl">Город не найден</p>
                <Link href="/" className="text-lime-400 underline">
                    На главную
                </Link>
            </main>
        );
    }

    const places = await getPlaces(citySlug);

    return <MapDesktop city={city} cities={cities} categories={categories} places={places} />;
}
