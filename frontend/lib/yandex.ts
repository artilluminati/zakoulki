/** Singleton-загрузка JS API Яндекс.Карт. Ключ — NEXT_PUBLIC_YANDEX_MAPS_API_KEY. */

declare global {
  interface Window {
    ymaps?: any;
  }
}

let promise: Promise<any> | null = null;

export function loadYandex(key: string): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.ymaps) return window.ymaps.ready();
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${key}&lang=ru_RU`;
    s.onload = () => window.ymaps.ready().then(() => resolve(window.ymaps)).catch(reject);
    s.onerror = () => { promise = null; reject(new Error("yandex load failed")); };
    document.head.appendChild(s);
  });
  return promise;
}
