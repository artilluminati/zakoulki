"use client";

import dynamic from "next/dynamic";
import type { City, Place } from "@/types";

// Leaflet использует window/document, поэтому рендерим карту только на клиенте.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center text-sm opacity-70">
            Загрузка карты…
        </div>
    ),
});

export default function MapView({
    city,
    places,
}: {
    city: City;
    places: Place[];
}) {
    return <LeafletMap city={city} places={places} />;
}
