"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowProps {
  title: string;
  icon?: string;
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
  icon = "🗂️",
  geo,
  zIndex,
  minWidth = 240,
  minHeight = 180,
  onFocus,
  onClose,
  onGeometryChange,
  children,
}: WindowProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    onFocus();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: geo.x, origY: geo.y };
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
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: geo.width, origH: geo.height };
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
      className="absolute flex flex-col overflow-hidden rounded-md border-2 border-[#0b3d91] bg-[#ece9d8] shadow-2xl"
      style={{ left: geo.x, top: geo.y, width: geo.width, height: geo.height, zIndex }}
      onPointerDownCapture={onFocus}
    >
      <div
        className="flex shrink-0 cursor-move touch-none select-none items-center justify-between gap-2 bg-gradient-to-b from-[#4c8cf5] via-[#1c5fd6] to-[#0b3d91] px-2 py-1 text-white"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="flex min-w-0 items-center gap-2 truncate text-sm font-bold">
          <span>{icon}</span>
          <span className="truncate">{title}</span>
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-white/40 bg-red-500 text-xs font-bold leading-none hover:bg-red-600"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-[#ece9d8] p-3 text-black">{children}</div>

      <div
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className="absolute bottom-0 right-0 h-4 w-4 touch-none cursor-nwse-resize"
        style={{ background: "repeating-linear-gradient(135deg, transparent 0 2px, #0b3d91 2px 3px)" }}
      />
    </div>
  );
}
