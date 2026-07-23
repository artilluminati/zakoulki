"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface TaskbarWindow {
    id: string;
    title: string;
    icon: string;
    open: boolean;
}

export default function Taskbar({
    cityName,
    windows,
    onToggle,
}: {
    cityName: string;
    windows: TaskbarWindow[];
    onToggle: (id: string) => void;
}) {
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
        const t = setInterval(update, 30_000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="absolute inset-x-0 bottom-0 z-50 flex h-11 items-center gap-2 border-t-2 border-[#0b3d91] bg-gradient-to-b from-[#2f6fe0] to-[#0b3d91] px-2 text-white">
            <Link
                href="/"
                className="flex h-8 items-center gap-1 rounded-sm border border-white/30 bg-gradient-to-b from-lime-400 to-green-600 px-3 text-sm font-bold text-black shadow-inner"
            >
                Zakoulki
            </Link>
            <span className="hidden text-xs opacity-80 sm:inline">
                {cityName}
            </span>
            <div className="mx-2 hidden h-6 w-px bg-white/30 sm:block" />
            <div className="flex flex-1 gap-1 overflow-x-auto">
                {windows.map((w) => (
                    <button
                        key={w.id}
                        onClick={() => onToggle(w.id)}
                        className={`flex h-8 shrink-0 items-center gap-1 rounded-sm border border-white/20 px-2 text-xs ${
                            w.open ? "bg-white/25" : "bg-white/5"
                        }`}
                    >
                        <span>{w.icon}</span>
                        {w.title}
                    </button>
                ))}
            </div>
            <div className="rounded-sm border border-white/20 bg-white/10 px-2 py-1 text-xs">
                {time}
            </div>
        </div>
    );
}
