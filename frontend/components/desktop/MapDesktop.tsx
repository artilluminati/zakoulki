"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Window, { type Geometry } from "./Window";
import Taskbar from "./Taskbar";
import CategoriesPanel from "./CategoriesPanel";
import AddPlacePanel from "./AddPlacePanel";
import YandexMap from "@/components/Map/YandexMap";
import type { City, Category, Place } from "@/types";

interface WinState {
  id: string;
  title: string;
  icon: string;
  open: boolean;
  geo: Geometry;
  z: number;
}

export default function MapDesktop({
  city,
  categories,
  places,
}: {
  city: City;
  categories: Category[];
  places: Place[];
}) {
  const [allPlaces, setAllPlaces] = useState<Place[]>(places);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pickMode, setPickMode] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<{ lat: number; lng: number } | null>(null);

  const zRef = useRef(10);
  const [windows, setWindows] = useState<Record<string, WinState>>({
    categories: {
      id: "categories",
      title: "Категории",
      icon: "📁",
      open: true,
      geo: { x: 24, y: 24, width: 280, height: 360 },
      z: 10,
    },
    addPlace: {
      id: "addPlace",
      title: "Добавить место",
      icon: "📍",
      open: false,
      geo: { x: 328, y: 24, width: 320, height: 400 },
      z: 9,
    },
  });

  const bringToFront = useCallback((id: string) => {
    zRef.current += 1;
    const z = zRef.current;
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], z } }));
  }, []);

  const openWindow = useCallback(
    (id: string) => {
      setWindows((prev) => ({ ...prev, [id]: { ...prev[id], open: true } }));
      bringToFront(id);
    },
    [bringToFront]
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], open: false } }));
    if (id === "addPlace") {
      setPickMode(false);
      setPickedPoint(null);
    }
  }, []);

  const toggleTaskbar = useCallback(
    (id: string) => {
      if (windows[id].open) {
        bringToFront(id);
      } else {
        openWindow(id);
      }
    },
    [windows, openWindow, bringToFront]
  );

  const updateGeometry = useCallback((id: string, geo: Geometry) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], geo } }));
  }, []);

  const filteredPlaces = useMemo(() => {
    if (selectedCategories.length === 0) return allPlaces;
    return allPlaces.filter((p) => p.categories.some((c) => selectedCategories.includes(c.slug)));
  }, [allPlaces, selectedCategories]);

  const handlePlaceCreated = useCallback((place: Place) => {
    setAllPlaces((prev) => [place, ...prev]);
    setPickMode(false);
    setPickedPoint(null);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0a3d91]">
      <div className="absolute inset-0 bottom-11">
        <YandexMap
          city={city}
          places={filteredPlaces}
          pickMode={pickMode}
          onPick={(lat, lng) => setPickedPoint({ lat, lng })}
        />
      </div>

      {windows.categories.open && (
        <Window
          title={windows.categories.title}
          icon={windows.categories.icon}
          geo={windows.categories.geo}
          zIndex={windows.categories.z}
          onFocus={() => bringToFront("categories")}
          onClose={() => closeWindow("categories")}
          onGeometryChange={(geo) => updateGeometry("categories", geo)}
        >
          <CategoriesPanel categories={categories} selected={selectedCategories} onChange={setSelectedCategories} />
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
            pickMode={pickMode}
            pickedPoint={pickedPoint}
            onTogglePick={() => setPickMode((v) => !v)}
            onCreated={handlePlaceCreated}
          />
        </Window>
      )}

      <Taskbar cityName={city.name} windows={Object.values(windows)} onToggle={toggleTaskbar} />
    </div>
  );
}
