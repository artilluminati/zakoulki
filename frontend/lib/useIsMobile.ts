"use client";

import { useEffect, useState } from "react";

/**
 * Плавающие resizable-окна с абсолютными пиксельными координатами не имеют
 * смысла на узких экранах — они попросту вылезают за пределы вьюпорта.
 * На мобильных окна вместо этого разворачиваются на весь экран (см. Window.tsx).
 */
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}
