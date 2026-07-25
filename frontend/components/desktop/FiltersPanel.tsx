"use client";

import {
    Search,
    Check,
    ImageIcon,
    LocateFixed,
    Loader2,
    RotateCcw,
} from "lucide-react";
import type { Category } from "@/types";

interface Props {
    categories: Category[];
    selected: string[];
    onChange: (slugs: string[]) => void;
    search: string;
    onSearchChange: (value: string) => void;
    onlyWithPhotos: boolean;
    onOnlyWithPhotosChange: (value: boolean) => void;
    nearMe: boolean;
    nearMeLoading: boolean;
    nearMeError: string | null;
    onToggleNearMe: () => void;
}

export default function FiltersPanel({
    categories,
    selected,
    onChange,
    search,
    onSearchChange,
    onlyWithPhotos,
    onOnlyWithPhotosChange,
    nearMe,
    nearMeLoading,
    nearMeError,
    onToggleNearMe,
}: Props) {
    const toggle = (slug: string) => {
        onChange(
            selected.includes(slug)
                ? selected.filter((s) => s !== slug)
                : [...selected, slug],
        );
    };

    const hasFilters =
        selected.length > 0 || search.length > 0 || onlyWithPhotos || nearMe;

    return (
        <div className="flex h-full flex-col gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-black">
            <div className="border-2 border-black bg-black px-3 py-2 text-[10px] tracking-[0.25em] text-white">
                FILTER SYSTEM
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />

                <input
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="SEARCH PLACE..."
                    className="
w-full
border-2
border-black
bg-white/10
py-2
pl-10
pr-3
font-mono
text-[11px]
uppercase
tracking-[0.12em]
placeholder:text-black/35
outline-none
backdrop-blur-[32px]
backdrop-saturate-[180%]
focus:bg-white/20
focus:ring-0
"
                />
            </div>

            <button
                type="button"
                onClick={onToggleNearMe}
                className={`
flex
items-center
justify-center
gap-2
border-2
border-black
px-3
py-2
font-mono
text-[11px]
uppercase
tracking-[0.12em]
transition-colors
${
    nearMe
        ? "bg-black text-white"
        : "bg-white/10 hover:bg-black hover:text-white"
}
`}
            >
                {nearMeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <LocateFixed className="h-4 w-4" />
                )}

                <span>{nearMe ? "Near Me Enabled" : "Locate Nearby"}</span>
            </button>

            {nearMeError && (
                <div className="border-2 border-black bg-black px-3 py-2 text-[10px] tracking-[0.15em] text-white">
                    ERROR // {nearMeError}
                </div>
            )}

            <label className="flex cursor-pointer items-center gap-3 border-2 border-black bg-white/10 px-3 py-2 transition-colors hover:bg-white/20">
                <input
                    type="checkbox"
                    checked={onlyWithPhotos}
                    onChange={(e) => onOnlyWithPhotosChange(e.target.checked)}
                    className="sr-only"
                />

                <span
                    className={`
flex
h-5
w-5
items-center
justify-center
border-2
border-black
transition-colors
${onlyWithPhotos ? "bg-black text-white" : "bg-transparent"}
`}
                >
                    {onlyWithPhotos && <Check className="h-3.5 w-3.5" />}
                </span>

                <ImageIcon className="h-4 w-4 shrink-0" />

                <span className="flex-1">Photos Only</span>
            </label>

            <div className="border-t-2 border-black" />

            <div className="text-[10px] tracking-[0.25em] text-black/55">
                CATEGORY SELECTOR
            </div>

            <div className="flex-1 overflow-auto border-2 border-black bg-white/5 backdrop-blur-[24px]">
                <div className="flex flex-col">
                    {categories.map((cat) => {
                        const active = selected.includes(cat.slug);

                        return (
                            <label
                                key={cat.id}
                                className={`
flex
cursor-pointer
items-center
gap-3
border-b-2
border-black
px-3
py-2
transition-colors
${active ? "bg-black text-white" : "bg-transparent hover:bg-white/20"}
`}
                            >
                                <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggle(cat.slug)}
                                    className="sr-only"
                                />

                                <span
                                    className={`
flex
h-5
w-5
items-center
justify-center
border-2
transition-colors
${active ? "border-white bg-white text-black" : "border-black"}
`}
                                >
                                    {active && (
                                        <Check className="h-3.5 w-3.5" />
                                    )}
                                </span>

                                <span className="flex-1 truncate">
                                    {cat.name}
                                </span>
                            </label>
                        );
                    })}
                    {categories.length === 0 && (
                        <div className="px-3 py-4 text-center text-[10px] tracking-[0.2em] text-black/45">
                            NO CATEGORIES
                        </div>
                    )}
                </div>
            </div>

            {hasFilters && (
                <button
                    onClick={() => {
                        onChange([]);
                        onSearchChange("");
                        onOnlyWithPhotosChange(false);

                        if (nearMe) {
                            onToggleNearMe();
                        }
                    }}
                    className="
flex
items-center
justify-center
gap-2
self-start
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
"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    RESET FILTERS
                </button>
            )}
        </div>
    );
}
