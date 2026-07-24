"use client";

import { useEffect, useRef, useState } from "react";
import { loadYandexMaps } from "@/lib/yandexMaps";
import { photoUrl } from "@/lib/api";
import type { City, Place } from "@/types";

const API_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "";

interface Props {
    city: City;
    places: Place[];
    pickMode?: boolean;
    onPick?: (lat: number, lng: number) => void;
}

function escapeHtml(str: string) {
    const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return str.replace(/[&<>"']/g, (c) => map[c]);
}

export default function YandexMap({ city, places, pickMode, onPick }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const clustererRef = useRef<any>(null);
    const pickMarkerRef = useRef<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    // Инициализация карты — один раз при монтировании компонента.
    useEffect(() => {
        let cancelled = false;
        if (!API_KEY) {
            setError(
                "Не задан NEXT_PUBLIC_YANDEX_MAPS_API_KEY. Получите бесплатный ключ на developer.tech.yandex.ru и укажите его в .env.local",
            );
            return;
        }
        loadYandexMaps(API_KEY)
            .then((ymaps) => {
                if (cancelled || !containerRef.current || mapRef.current)
                    return;
                const map = new ymaps.Map(containerRef.current, {
                    center: [city.center_lat, city.center_lng],
                    zoom: city.default_zoom,
                    controls: [
                        "zoomControl",
                        "geolocationControl",
                        "typeSelector",
                    ],
                });
                mapRef.current = map;
                clustererRef.current = new ymaps.Clusterer({
                    preset: "islands#lightGreenClusterIcons",
                    groupByCoordinates: false,
                });
                map.geoObjects.add(clustererRef.current);
                setReady(true);
            })
            .catch((e: Error) => setError(e.message));

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Перелёт к центру города при смене города.
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.setCenter(
                [city.center_lat, city.center_lng],
                city.default_zoom,
            );
        }
    }, [city]);

    // Обновление меток мест на карте.
    useEffect(() => {
        if (!ready || !clustererRef.current || !window.ymaps) return;
        const ymaps = window.ymaps;
        clustererRef.current.removeAll();
        const placemarks = places.map(
            (place) =>
                new ymaps.Placemark(
                    [place.latitude, place.longitude],
                    {
                        balloonContentHeader: place.cover_photo
                            ? `<img src="${photoUrl(place.cover_photo.file_name)}" alt="" style="width:100%;max-height:150px;object-fit:cover;border-radius:4px;margin-bottom:6px;display:block;" />`
                            : "",
                        balloonContentBody: `<b>${escapeHtml(place.title)}</b>${
                            place.categories?.length
                                ? `<div style="font-size:12px;opacity:.7;margin:4px 0;">${place.categories
                                      .map((c) => escapeHtml(c.name))
                                      .join(", ")}</div>`
                                : ""
                        }`,
                        balloonContentFooter: `<a href="/place/${place.slug}">Открыть место →</a>`,
                        hintContent: place.title,
                    },
                    { preset: "islands#greenDotIconWithCaption" },
                ),
        );
        clustererRef.current.add(placemarks);
    }, [ready, places]);

    // Режим выбора точки на карте (для добавления нового места).
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map || !window.ymaps) return;
        const ymaps = window.ymaps;

        const handleClick = (e: any) => {
            if (!pickMode || !onPick) return;
            const coords = e.get("coords") as [number, number];
            onPick(coords[0], coords[1]);

            if (pickMarkerRef.current) {
                map.geoObjects.remove(pickMarkerRef.current);
            }
            const marker = new ymaps.Placemark(
                coords,
                {},
                { preset: "islands#redIcon" },
            );
            map.geoObjects.add(marker);
            pickMarkerRef.current = marker;
        };

        map.events.add("click", handleClick);
        return () => map.events.remove("click", handleClick);
    }, [ready, pickMode, onPick]);

    // Сброс временной метки при отмене режима выбора точки.
    useEffect(() => {
        if (!pickMode && pickMarkerRef.current && mapRef.current) {
            mapRef.current.geoObjects.remove(pickMarkerRef.current);
            pickMarkerRef.current = null;
        }
    }, [pickMode]);

    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-neutral-900 p-6 text-center text-sm text-red-300">
                {error}
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
            {pickMode && (
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-red-400 bg-black/70 px-3 py-1 text-xs text-red-200">
                    Кликните по карте, чтобы выбрать точку
                </div>
            )}
        </div>
    );
}
