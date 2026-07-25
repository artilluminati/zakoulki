"use client";

import {
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";

export interface Geometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface WindowProps {
    title: string;
    icon?: ReactNode;
    geo: Geometry;
    zIndex: number;
    minWidth?: number;
    minHeight?: number;
    onFocus: () => void;
    onClose: () => void;
    onGeometryChange: (geo: Geometry) => void;
    children: ReactNode;
}

export default function Window({
    title,
    icon,
    geo,
    zIndex,
    minWidth = 320,
    minHeight = 240,
    onFocus,
    onClose,
    onGeometryChange,
    children,
}: WindowProps) {
    const isMobile = useIsMobile();

    const dragRef = useRef<{
        startX: number;
        startY: number;
        origX: number;
        origY: number;
    } | null>(null);

    const resizeRef = useRef<{
        startX: number;
        startY: number;
        origW: number;
        origH: number;
    } | null>(null);

    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);

    const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (isMobile) return;

        onFocus();
        setDragging(true);

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: geo.x,
            origY: geo.y,
        };

        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragging || !dragRef.current) return;

        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;

        onGeometryChange({
            ...geo,
            x: Math.max(0, dragRef.current.origX + dx),
            y: Math.max(0, dragRef.current.origY + dy),
        });
    };

    const endDrag = () => {
        setDragging(false);
        dragRef.current = null;
    };

    const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
        e.stopPropagation();

        onFocus();
        setResizing(true);

        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origW: geo.width,
            origH: geo.height,
        };

        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const moveResize = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!resizing || !resizeRef.current) return;

        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;

        onGeometryChange({
            ...geo,
            width: Math.max(minWidth, resizeRef.current.origW + dx),
            height: Math.max(minHeight, resizeRef.current.origH + dy),
        });
    };

    const endResize = () => {
        setResizing(false);
        resizeRef.current = null;
    };

    return (
        <div
            onPointerDownCapture={onFocus}
            className={
                isMobile
                    ? `
                      absolute inset-x-2 top-2 bottom-14
                      flex flex-col overflow-hidden
                      border-2 border-black
                      bg-white/10
                      backdrop-blur-[48px]
                      backdrop-saturate-[220%]
                      backdrop-brightness-125
                      select-none
                      `
                    : `
                      absolute
                      flex flex-col overflow-hidden
                      border-2 border-black
                      bg-white/10
                      backdrop-blur-[48px]
                      backdrop-saturate-[220%]
                      backdrop-brightness-125
                      transition-shadow duration-150
                      select-none
                      `
            }
            style={
                isMobile
                    ? {
                          zIndex,
                          boxShadow: `
                          0 0 0 1px rgba(255,255,255,.5) inset,
                          0 0 0 3px rgba(0,0,0,.95),
                          0 20px 60px rgba(0,0,0,.45)
                          `,
                      }
                    : {
                          left: geo.x,
                          top: geo.y,
                          width: geo.width,
                          height: geo.height,
                          zIndex,
                          boxShadow: `
                          0 0 0 1px rgba(255,255,255,.5) inset,
                          0 0 0 3px rgba(0,0,0,.95),
                          0 20px 60px rgba(0,0,0,.45)
                          `,
                      }
            }
        >
            {/* TITLEBAR */}

            <div
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={`
                h-14
                border-b-2
                border-black
                bg-black/90
                backdrop-blur-xl
                px-4
                flex
                items-center
                justify-between
                ${isMobile ? "" : "cursor-move"}
                `}
            >
                <div className="flex items-center gap-4 min-w-0">
                    {icon && (
                        <span className="text-white [&>svg]:w-4 [&>svg]:h-4">
                            {icon}
                        </span>
                    )}

                    <span className="truncate font-mono text-[13px] uppercase tracking-[0.25em] text-white">
                        {title}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="hidden md:block font-mono text-[10px] tracking-[0.25em] text-white/40">
                        ACTIVE
                    </span>

                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="
                          w-8
                          h-8
                          border-2
                          border-white
                          bg-black
                          text-white
                          flex
                          items-center
                          justify-center
                          transition-colors
                          hover:bg-white
                          hover:text-black
                        "
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* CONTENT */}

            <div className="relative flex-1 overflow-auto bg-transparent">
                <div className="pointer-events-none absolute inset-0 opacity-[0.05]">
                    <div
                        className="h-full w-full"
                        style={{
                            backgroundImage: `
                              linear-gradient(to right, black 1px, transparent 1px),
                              linear-gradient(to bottom, black 1px, transparent 1px)
                            `,
                            backgroundSize: "32px 32px",
                        }}
                    />
                </div>

                <div className="relative p-6 text-black">{children}</div>
            </div>

            {/* STATUS BAR */}

            <div className="h-8 border-t-2 border-black bg-white/10 backdrop-blur-xl flex items-center justify-between px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/60">
                <span>
                    {geo.width}×{geo.height}
                </span>
            </div>

            {!isMobile && (
                <div
                    onPointerDown={startResize}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                    className="
                    absolute
                    bottom-1
                    right-1
                    w-4
                    h-4
                    cursor-nwse-resize
                    border-2
                    border-black
                    bg-white/40
                    backdrop-blur-xl
                    hover:bg-black
                    hover:border-white
                    "
                />
            )}
        </div>
    );
}
