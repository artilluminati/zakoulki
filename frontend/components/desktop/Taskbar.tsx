"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Compass, Clock } from "lucide-react";
import type { City } from "@/types";

export interface TaskbarWindow {
    id: string;
    title: string;
    icon?: ReactNode;
    open: boolean;
}

export default function Taskbar({
    city,
    cities,
    windows,
    onToggle,
}: {
    city: City;
    cities: City[];
    windows: TaskbarWindow[];
    onToggle: (id: string) => void;
}) {
    const router = useRouter();
    const [time, setTime] = useState("");

    useEffect(() => {
        const update = () =>
            setTime(
                new Date().toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            );

        update();

        const t = setInterval(update, 30000);

        return () => clearInterval(t);
    }, []);

    return (
        <footer
            className="
absolute
bottom-0
left-0
right-0
z-50
h-14
border-t-2
border-black
bg-white/10
backdrop-blur-[48px]
backdrop-saturate-[200%]
backdrop-brightness-125
"
            style={{
                boxShadow: `
0 -2px 0 rgba(255,255,255,.45) inset,
0 0 0 2px rgba(0,0,0,.95)
`,
            }}
        >
            <div className="flex h-full items-center gap-2 px-2">
                {/* LOGO */}

                <Link
                    href="/"
                    className="
flex
h-10
shrink-0
items-center
gap-2
border-2
border-black
bg-black
px-3
font-mono
text-[11px]
font-bold
uppercase
tracking-[0.2em]
text-white
transition-colors
hover:bg-white
hover:text-black
"
                >
                    <Compass className="h-4 w-4" />
                    ZAKOULKI
                </Link>

                {/* CITY */}

                <div
                    className="
hidden
sm:flex
h-10
items-center
gap-2
border-2
border-black
bg-white/10
px-2
font-mono
text-[10px]
uppercase
tracking-[0.18em]
"
                >
                    <span className="text-black/60">CITY</span>

                    <select
                        value={city.slug}
                        onChange={(e) => router.push(`/map/${e.target.value}`)}
                        className="
bg-transparent
outline-none
font-mono
text-[11px]
uppercase
tracking-[0.15em]
"
                    >
                        {cities.map((c) => (
                            <option
                                key={c.id}
                                value={c.slug}
                                className="text-black"
                            >
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* WINDOWS */}

                <div className="flex flex-1 gap-2 overflow-x-auto">
                    {windows.map((w) => (
                        <button
                            key={w.id}
                            onClick={() => onToggle(w.id)}
                            className={`
flex
h-10
shrink-0
items-center
gap-2
border-2
px-3
font-mono
text-[11px]
uppercase
tracking-[0.15em]
transition-colors
${
    w.open
        ? "border-black bg-black text-white"
        : "border-black bg-white/10 text-black hover:bg-black hover:text-white"
}
`}
                        >
                            {w.icon && (
                                <span className="[&>svg]:h-4 [&>svg]:w-4">
                                    {w.icon}
                                </span>
                            )}

                            <span>{w.title}</span>
                        </button>
                    ))}
                </div>

                {/* STATUS */}

                <div
                    className="
flex
h-10
items-center
gap-2
border-2
border-black
bg-white/10
px-3
font-mono
text-[10px]
uppercase
tracking-[0.2em]
"
                >
                    <Clock className="h-4 w-4" />

                    <span className="text-black/50">TIME</span>

                    <span className="text-black">{time}</span>
                </div>
            </div>
        </footer>
    );
}
