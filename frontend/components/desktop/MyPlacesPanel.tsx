"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Pencil,
    Trash2,
    Check,
    X,
    ExternalLink,
    Crosshair,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getApiError } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import type { Category, Place } from "@/types";

interface Props {
    places: Place[];
    categories: Category[];
    onRequestLogin: () => void;
    onUpdated: (place: Place) => void;
    onDeleted: (placeId: number) => void;
    pickingPlaceId: number | null;
    pickedPoint: { lat: number; lng: number } | null;
    onStartPickLocation: (placeId: number) => void;
    onCancelPickLocation: () => void;
}

export default function MyPlacesPanel({
    places,
    categories,
    onRequestLogin,
    onUpdated,
    onDeleted,
    pickingPlaceId,
    pickedPoint,
    onStartPickLocation,
    onCancelPickLocation,
}: Props) {
    const { user, loading: authLoading } = useAuth();
    const toast = useToast();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editCategoryIds, setEditCategoryIds] = useState<number[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (authLoading) {
        return (
            <div className="border-2 border-black bg-black px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white">
                Checking Session...
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-full flex-col gap-4 font-mono text-[11px] uppercase tracking-[0.15em]">
                <div className="border-2 border-black bg-black px-3 py-2 text-[10px] tracking-[0.25em] text-white">
                    USER AUTHORIZATION REQUIRED
                </div>

                <div className="border-2 border-black bg-white/10 p-4 backdrop-blur-[28px]">
                    Login to manage your own places.
                </div>

                <button
                    onClick={onRequestLogin}
                    className="
border-2
border-black
bg-black
px-4
py-2
font-mono
text-[11px]
uppercase
tracking-[0.15em]
text-white
transition-colors
hover:bg-white
hover:text-black
"
                >
                    Login / Register
                </button>
            </div>
        );
    }

    const myPlaces = places.filter((p) => p.created_by === user.id);

    const startEdit = (place: Place) => {
        setError(null);
        setConfirmDeleteId(null);
        setEditingId(place.id);
        setEditTitle(place.title);
        setEditCategoryIds(place.categories.map((c) => c.id));
    };

    const cancelEdit = () => {
        setEditingId(null);
        onCancelPickLocation();
    };

    const toggleEditCategory = (id: number) => {
        setEditCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
        );
    };

    const saveEdit = async (place: Place) => {
        if (!editTitle.trim()) {
            setError("Title cannot be empty");
            return;
        }

        setBusyId(place.id);
        setError(null);

        try {
            const payload: Record<string, unknown> = {
                title: editTitle,
                category_ids: editCategoryIds,
            };

            if (pickingPlaceId === place.id && pickedPoint) {
                payload.latitude = pickedPoint.lat;
                payload.longitude = pickedPoint.lng;
            }

            const res = await api.patch(`/places/${place.id}`, payload);

            onUpdated(res.data);

            setEditingId(null);

            onCancelPickLocation();

            toast("Место обновлено", "success");
        } catch (err) {
            setError(getApiError(err, "Не удалось сохранить изменения"));
        } finally {
            setBusyId(null);
        }
    };

    const doDelete = async (placeId: number) => {
        setBusyId(placeId);
        setError(null);

        try {
            await api.delete(`/places/${placeId}`);

            onDeleted(placeId);

            toast("Место удалено", "success");
        } catch (err) {
            setError(getApiError(err, "Не удалось удалить место"));
        } finally {
            setBusyId(null);
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="flex h-full flex-col gap-4 font-mono text-[11px] uppercase tracking-[0.12em]">
            <div className="border-2 border-black bg-black px-3 py-2 text-[10px] tracking-[0.25em] text-white">
                MY PLACES DATABASE
            </div>

            <div className="border-2 border-black bg-white/10 px-3 py-2 backdrop-blur-[24px] text-black/70">
                Edit titles, categories, map position or permanently delete
                places.
            </div>

            {error && (
                <div className="border-2 border-black bg-black px-3 py-2 text-[10px] tracking-[0.15em] text-white">
                    ERROR // {error}
                </div>
            )}

            <div className="flex-1 space-y-3 overflow-auto">
                {myPlaces.length === 0 && (
                    <div className="border-2 border-black bg-white/10 px-4 py-6 text-center text-black/50 backdrop-blur-[24px]">
                        NO PLACES FOUND
                    </div>
                )}

                {myPlaces.map((place) => {
                    const isEditing = editingId === place.id;
                    const isBusy = busyId === place.id;
                    const isConfirmingDelete = confirmDeleteId === place.id;
                    const isPickingForThis = pickingPlaceId === place.id;

                    if (isEditing) {
                        return (
                            <div
                                key={place.id}
                                className="
border-2
border-black
bg-white/10
backdrop-blur-[30px]
"
                            >
                                <div className="border-b-2 border-black bg-black px-3 py-2 text-[10px] tracking-[0.25em] text-white">
                                    EDIT MODE
                                </div>

                                <div className="space-y-3 p-3">
                                    <input
                                        value={editTitle}
                                        disabled={isBusy}
                                        onChange={(e) =>
                                            setEditTitle(e.target.value)
                                        }
                                        className="
w-full
border-2
border-black
bg-white/10
px-3
py-2
font-mono
text-[11px]
uppercase
tracking-[0.12em]
outline-none
backdrop-blur-[24px]
focus:bg-white/20
"
                                    />

                                    <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                            isPickingForThis
                                                ? onCancelPickLocation()
                                                : onStartPickLocation(place.id)
                                        }
                                        className={`
flex
w-full
items-center
justify-center
gap-2
border-2
border-black
px-3
py-2
transition-colors
${
    isPickingForThis
        ? "bg-black text-white"
        : "bg-white/10 hover:bg-black hover:text-white"
}
`}
                                    >
                                        <Crosshair className="h-4 w-4" />

                                        {isPickingForThis
                                            ? "Cancel Location Pick"
                                            : "Pick New Location"}
                                    </button>

                                    {isPickingForThis && (
                                        <div className="border-2 border-black bg-white/10 px-3 py-2 text-[10px] tracking-[0.15em]">
                                            {pickedPoint
                                                ? `${pickedPoint.lat.toFixed(
                                                      5,
                                                  )} // ${pickedPoint.lng.toFixed(
                                                      5,
                                                  )}`
                                                : "Waiting For Map Click"}
                                        </div>
                                    )}

                                    <div className="max-h-40 overflow-auto border-2 border-black bg-white/5">
                                        {categories.map((cat) => (
                                            <label
                                                key={cat.id}
                                                className={`
flex
items-center
gap-3
border-b-2
border-black
px-3
py-2
cursor-pointer
transition-colors
${
    editCategoryIds.includes(cat.id)
        ? "bg-black text-white"
        : "hover:bg-white/20"
}
`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={editCategoryIds.includes(
                                                        cat.id,
                                                    )}
                                                    disabled={isBusy}
                                                    onChange={() =>
                                                        toggleEditCategory(
                                                            cat.id,
                                                        )
                                                    }
                                                />

                                                <span
                                                    className={`
flex
h-5
w-5
items-center
justify-center
border-2
${
    editCategoryIds.includes(cat.id)
        ? "border-white bg-white text-black"
        : "border-black"
}
`}
                                                >
                                                    {editCategoryIds.includes(
                                                        cat.id,
                                                    ) && (
                                                        <Check className="h-3.5 w-3.5" />
                                                    )}
                                                </span>

                                                <span className="flex-1 truncate">
                                                    {cat.name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => saveEdit(place)}
                                            className="
flex-1
border-2
border-black
bg-black
px-3
py-2
font-mono
text-[11px]
uppercase
tracking-[0.15em]
text-white
transition-colors
hover:bg-white
hover:text-black
disabled:opacity-50
"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                <Check className="h-4 w-4" />

                                                {isBusy ? "Saving..." : "Save"}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={cancelEdit}
                                            className="
flex-1
border-2
border-black
bg-white/10
px-3
py-2
font-mono
text-[11px]
uppercase
tracking-[0.15em]
transition-colors
hover:bg-black
hover:text-white
disabled:opacity-50
"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                <X className="h-4 w-4" />
                                                Cancel
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={place.id}
                            className="
border-2
border-black
bg-white/10
backdrop-blur-[28px]
"
                        >
                            <div className="border-b-2 border-black bg-black px-3 py-2 flex items-center justify-between">
                                <span className="truncate text-[10px] tracking-[0.25em] text-white">
                                    {place.title}
                                </span>

                                <Link
                                    href={`/place/${place.slug}`}
                                    target="_blank"
                                    className="
border
border-white
p-1
text-white
transition-colors
hover:bg-white
hover:text-black
"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </div>

                            <div className="space-y-3 p-3">
                                {place.categories.length > 0 && (
                                    <div className="text-[10px] tracking-[0.15em] text-black/60">
                                        {place.categories
                                            .map((c) => c.name)
                                            .join(" // ")}
                                    </div>
                                )}

                                {isConfirmingDelete ? (
                                    <div className="space-y-3">
                                        <div className="border-2 border-black bg-black px-3 py-2 text-white text-[10px] tracking-[0.2em]">
                                            DELETE THIS PLACE?
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                disabled={isBusy}
                                                onClick={() =>
                                                    doDelete(place.id)
                                                }
                                                className="
flex-1
border-2
border-black
bg-black
px-3
py-2
text-white
transition-colors
hover:bg-white
hover:text-black
disabled:opacity-50
"
                                            >
                                                {isBusy
                                                    ? "Deleting..."
                                                    : "Delete"}
                                            </button>

                                            <button
                                                disabled={isBusy}
                                                onClick={() =>
                                                    setConfirmDeleteId(null)
                                                }
                                                className="
flex-1
border-2
border-black
bg-white/10
px-3
py-2
transition-colors
hover:bg-black
hover:text-white
disabled:opacity-50
"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEdit(place)}
                                            className="
flex-1
border-2
border-black
bg-white/10
px-3
py-2
transition-colors
hover:bg-black
hover:text-white
"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                <Pencil className="h-4 w-4" />
                                                Edit
                                            </span>
                                        </button>

                                        <button
                                            onClick={() =>
                                                setConfirmDeleteId(place.id)
                                            }
                                            className="
flex-1
border-2
border-black
bg-white/10
px-3
py-2
transition-colors
hover:bg-black
hover:text-white
"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                <Trash2 className="h-4 w-4" />
                                                Delete
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
