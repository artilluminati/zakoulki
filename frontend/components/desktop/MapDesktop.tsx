"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ListFilter, MapPin, FolderOpen, User } from "lucide-react";
import Window, { type Geometry } from "./Window";
import Taskbar from "./Taskbar";
import FiltersPanel from "./FiltersPanel";
import AddPlacePanel from "./AddPlacePanel";
import AuthPanel from "./AuthPanel";
import MyPlacesPanel from "./MyPlacesPanel";
import YandexMap from "@/components/Map/YandexMap";
import { useAuth } from "@/lib/auth";
import { distanceKm } from "@/lib/geo";
import type { City, Category, Place } from "@/types";

interface WinState {
    id: string;
    title: string;
    icon: ReactNode;
    open: boolean;
    geo: Geometry;
    z: number;
}

const NEAR_ME_RADIUS_KM = 3;

export default function MapDesktop({
    city,
    cities,
    categories,
    places,
}: {
    city: City;
    cities: City[];
    categories: Category[];
    places: Place[];
}) {
    const { user } = useAuth();
    const [allPlaces, setAllPlaces] = useState<Place[]>(places);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);

    // "рядом со мной"
    const [nearMe, setNearMe] = useState(false);
    const [nearMeLoading, setNearMeLoading] = useState(false);
    const [nearMeError, setNearMeError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Общий механизм "выбора точки на карте" — используется и окном
    // "Добавить место" (pickTarget === "add"), и переносом координат
    // существующего места в "Моих местах" (pickTarget === id места).
    const [pickTarget, setPickTarget] = useState<"add" | number | null>(null);
    const [pickedPoint, setPickedPoint] = useState<{ lat: number; lng: number } | null>(null);

    const zRef = useRef(10);
    const [windows, setWindows] = useState<Record<string, WinState>>({
        filters: {
            id: "filters",
            title: "Фильтры",
            icon: <ListFilter />,
            open: true,
            geo: { x: 24, y: 24, width: 300, height: 460 },
            z: 10,
        },
        addPlace: {
            id: "addPlace",
            title: "Добавить место",
            icon: <MapPin />,
            open: false,
            geo: { x: 344, y: 24, width: 320, height: 520 },
            z: 9,
        },
        myPlaces: {
            id: "myPlaces",
            title: "Мои места",
            icon: <FolderOpen />,
            open: false,
            geo: { x: 24, y: 500, width: 320, height: 300 },
            z: 7,
        },
        auth: {
            id: "auth",
            title: "Аккаунт",
            icon: <User />,
            open: false,
            geo: { x: 684, y: 24, width: 300, height: 340 },
            z: 8,
        },
    });

    const bringToFront = useCallback((id: string) => {
        zRef.current += 1;
        const z = zRef.current;
        setWindows((prev) => ({ ...prev, [id]: { ...prev[id], z } }));
    }, []);

    const openWindow = useCallback(
        (id: string) => {
            setWindows((prev) => ({
                ...prev,
                [id]: { ...prev[id], open: true },
            }));
            bringToFront(id);
        },
        [bringToFront],
    );

    const closeWindow = useCallback((id: string) => {
        setWindows((prev) => ({ ...prev, [id]: { ...prev[id], open: false } }));
        if (id === "addPlace" && pickTarget === "add") {
            setPickTarget(null);
            setPickedPoint(null);
        }
        if (id === "myPlaces" && typeof pickTarget === "number") {
            setPickTarget(null);
            setPickedPoint(null);
        }
    }, [pickTarget]);

    const toggleTaskbar = useCallback(
        (id: string) => {
            if (windows[id].open) {
                bringToFront(id);
            } else {
                openWindow(id);
            }
        },
        [windows, openWindow, bringToFront],
    );

    const updateGeometry = useCallback((id: string, geo: Geometry) => {
        setWindows((prev) => ({ ...prev, [id]: { ...prev[id], geo } }));
    }, []);

    const filteredPlaces = useMemo(() => {
        return allPlaces.filter((p) => {
            if (selectedCategories.length > 0 && !p.categories.some((c) => selectedCategories.includes(c.slug))) {
                return false;
            }
            if (onlyWithPhotos && !p.cover_photo) {
                return false;
            }
            if (search.trim() && !p.title.toLowerCase().includes(search.trim().toLowerCase())) {
                return false;
            }
            if (nearMe && userLocation) {
                const d = distanceKm(userLocation, { lat: p.latitude, lng: p.longitude });
                if (d > NEAR_ME_RADIUS_KM) return false;
            }
            return true;
        });
    }, [allPlaces, selectedCategories, onlyWithPhotos, search, nearMe, userLocation]);

    const handlePlaceCreated = useCallback((place: Place) => {
        setAllPlaces((prev) => [place, ...prev]);
        setPickTarget(null);
        setPickedPoint(null);
    }, []);

    const handlePlaceUpdated = useCallback((place: Place) => {
        setAllPlaces((prev) => prev.map((p) => (p.id === place.id ? place : p)));
    }, []);

    const handlePlaceDeleted = useCallback((placeId: number) => {
        setAllPlaces((prev) => prev.filter((p) => p.id !== placeId));
    }, []);

    const handleToggleAddPick = useCallback(() => {
        setPickTarget((prev) => (prev === "add" ? null : "add"));
        setPickedPoint(null);
    }, []);

    const handleStartPickForPlace = useCallback((placeId: number) => {
        setPickTarget(placeId);
        setPickedPoint(null);
        bringToFront("myPlaces");
    }, [bringToFront]);

    const handleCancelPickForPlace = useCallback(() => {
        setPickTarget((prev) => (typeof prev === "number" ? null : prev));
        setPickedPoint(null);
    }, []);

    const handleToggleNearMe = useCallback(() => {
        if (nearMe) {
            setNearMe(false);
            setUserLocation(null);
            setNearMeError(null);
            return;
        }
        if (!navigator.geolocation) {
            setNearMeError("Геолокация не поддерживается этим браузером");
            return;
        }
        setNearMeLoading(true);
        setNearMeError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setNearMe(true);
                setNearMeLoading(false);
            },
            () => {
                setNearMeError("Не удалось определить местоположение — проверьте разрешения браузера");
                setNearMeLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10_000 },
        );
    }, [nearMe]);

    // Кнопка в таскбаре показывает имя пользователя, если он вошёл в систему.
    const taskbarWindows = useMemo(
        () =>
            Object.values(windows).map((w) =>
                w.id === "auth"
                    ? { ...w, title: user ? user.username : "Войти" }
                    : w,
            ),
        [windows, user],
    );

    return (
        <div className="relative h-screen w-full overflow-hidden bg-[#0a3d91]">
            <div className="absolute inset-0 bottom-11">
                <YandexMap
                    city={city}
                    places={filteredPlaces}
                    pickMode={pickTarget !== null}
                    onPick={(lat, lng) => setPickedPoint({ lat, lng })}
                    userLocation={userLocation}
                />
            </div>

            {windows.filters.open && (
                <Window
                    title={windows.filters.title}
                    icon={windows.filters.icon}
                    geo={windows.filters.geo}
                    zIndex={windows.filters.z}
                    onFocus={() => bringToFront("filters")}
                    onClose={() => closeWindow("filters")}
                    onGeometryChange={(geo) => updateGeometry("filters", geo)}
                >
                    <FiltersPanel
                        categories={categories}
                        selected={selectedCategories}
                        onChange={setSelectedCategories}
                        search={search}
                        onSearchChange={setSearch}
                        onlyWithPhotos={onlyWithPhotos}
                        onOnlyWithPhotosChange={setOnlyWithPhotos}
                        nearMe={nearMe}
                        nearMeLoading={nearMeLoading}
                        nearMeError={nearMeError}
                        onToggleNearMe={handleToggleNearMe}
                    />
                </Window>
            )}

            {windows.addPlace.open && (
                <Window
                    title={windows.addPlace.title}
                    icon={windows.addPlace.icon}
                    geo={windows.addPlace.geo}
                    zIndex={windows.addPlace.z}
                    onFocus={() => bringToFront("addPlace")}
                    onClose={() => closeWindow("addPlace")}
                    onGeometryChange={(geo) => updateGeometry("addPlace", geo)}
                >
                    <AddPlacePanel
                        city={city}
                        categories={categories}
                        pickMode={pickTarget === "add"}
                        pickedPoint={pickTarget === "add" ? pickedPoint : null}
                        onTogglePick={handleToggleAddPick}
                        onCreated={handlePlaceCreated}
                        onRequestLogin={() => openWindow("auth")}
                    />
                </Window>
            )}

            {windows.myPlaces.open && (
                <Window
                    title={windows.myPlaces.title}
                    icon={windows.myPlaces.icon}
                    geo={windows.myPlaces.geo}
                    zIndex={windows.myPlaces.z}
                    onFocus={() => bringToFront("myPlaces")}
                    onClose={() => closeWindow("myPlaces")}
                    onGeometryChange={(geo) => updateGeometry("myPlaces", geo)}
                >
                    <MyPlacesPanel
                        places={allPlaces}
                        categories={categories}
                        onRequestLogin={() => openWindow("auth")}
                        onUpdated={handlePlaceUpdated}
                        onDeleted={handlePlaceDeleted}
                        pickingPlaceId={typeof pickTarget === "number" ? pickTarget : null}
                        pickedPoint={typeof pickTarget === "number" ? pickedPoint : null}
                        onStartPickLocation={handleStartPickForPlace}
                        onCancelPickLocation={handleCancelPickForPlace}
                    />
                </Window>
            )}

            {windows.auth.open && (
                <Window
                    title={windows.auth.title}
                    icon={windows.auth.icon}
                    geo={windows.auth.geo}
                    zIndex={windows.auth.z}
                    onFocus={() => bringToFront("auth")}
                    onClose={() => closeWindow("auth")}
                    onGeometryChange={(geo) => updateGeometry("auth", geo)}
                >
                    <AuthPanel />
                </Window>
            )}

            <Taskbar
                city={city}
                cities={cities}
                windows={taskbarWindows}
                onToggle={toggleTaskbar}
            />
        </div>
    );
}
