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
        <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-4 text-white">
            <div className="text-center">
                <h1 className="text-4xl font-black tracking-tight">Закоулки</h1>
                <p className="mt-2 max-w-md text-sm opacity-70">
                    Увидел → Сфотографировал → Отметил на карте → Поделился с
                    другими
                </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
                {cities.length === 0 && (
                    <p className="max-w-sm text-center text-sm opacity-50">
                        Города не загружены. Проверьте, что backend запущен на
                        localhost:8000 и выполнен сид базы (python -m
                        app.db.seed).
                    </p>
                )}
                {cities.map((city) => (
                    <Link
                        key={city.id}
                        href={`/map/${city.slug}`}
                        className="border-2 border-lime-400 px-6 py-3 font-bold uppercase text-lime-400 transition hover:bg-lime-400 hover:text-black"
                    >
                        {city.name}
                    </Link>
                ))}
            </div>
        </main>
    );
}
