"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import type { City, Place } from "@/types";

// Иконки Leaflet по умолчанию ломаются в сборке Next.js — чиним вручную,
// подтягивая изображения маркеров с CDN.
// @ts-expect-error — приватное поле, отсутствующее в типах Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FlyToCity({ city }: { city: City }) {
    const map = useMap();
    useEffect(() => {
        map.setView([city.center_lat, city.center_lng], city.default_zoom);
    }, [city, map]);
    return null;
}

export default function LeafletMap({
    city,
    places,
}: {
    city: City;
    places: Place[];
}) {
    return (
        <MapContainer
            center={[city.center_lat, city.center_lng]}
            zoom={city.default_zoom}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToCity city={city} />
            {places.map((place) => (
                <Marker
                    key={place.id}
                    position={[place.latitude, place.longitude]}
                >
                    <Popup>
                        <div style={{ minWidth: 160 }}>
                            <p style={{ fontWeight: 700, marginBottom: 4 }}>
                                {place.title}
                            </p>
                            {place.categories?.length > 0 && (
                                <p
                                    style={{
                                        fontSize: 12,
                                        opacity: 0.7,
                                        marginBottom: 8,
                                    }}
                                >
                                    {place.categories
                                        .map((c) => c.name)
                                        .join(", ")}
                                </p>
                            )}
                            <Link
                                href={`/place/${place.slug}`}
                                style={{
                                    color: "#2563eb",
                                    textDecoration: "underline",
                                    fontSize: 13,
                                }}
                            >
                                Открыть место →
                            </Link>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
