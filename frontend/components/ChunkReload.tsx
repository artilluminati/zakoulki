"use client";

import { useEffect } from "react";

/** После деплоя старые страницы просят уже удалённые чанки —
 * вместо вечной ошибки один раз мягко перезагружаемся. */
export default function ChunkReload() {
  useEffect(() => {
    let reloaded = false;
    const onReject = (e: PromiseRejectionEvent) => {
      const msg = String((e.reason as Error)?.message ?? e.reason ?? "");
      if (!reloaded && /ChunkLoadError|Loading chunk .* failed/i.test(msg)) {
        reloaded = true;
        try { sessionStorage.setItem("zakoulki_chunk_reload", "1"); } catch { /* ignore */ }
        window.location.reload();
      }
    };
    const onError = (e: ErrorEvent) => {
      const msg = String(e.message ?? "");
      if (!reloaded && /ChunkLoadError|Loading chunk .* failed/i.test(msg)) {
        reloaded = true;
        window.location.reload();
      }
    };
    window.addEventListener("unhandledrejection", onReject);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onReject);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
