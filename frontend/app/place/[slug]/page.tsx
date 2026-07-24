import Link from "next/link";
import { api } from "@/lib/api";
import PlaceDetailClient from "@/components/place/PlaceDetailClient";
import type { PlaceDetail } from "@/types";

async function getPlace(slug: string): Promise<PlaceDetail | null> {
  try {
    const res = await api.get(`/places/slug/${encodeURIComponent(slug)}`);
    return res.data;
  } catch {
    return null;
  }
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);

  if (!place) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 text-white">
        <p className="text-xl">Место не найдено 🧭</p>
        <Link href="/" className="text-lime-400 underline">
          На главную
        </Link>
      </main>
    );
  }

  return <PlaceDetailClient place={place} />;
}
