declare global {
  interface Window {
    ymaps: any;
  }
}

let loadingPromise: Promise<any> | null = null;

/**
 * Загружает JavaScript API Яндекс Карт (v2.1) один раз за сессию браузера
 * и переиспользует уже загруженный инстанс при повторных вызовах —
 * это единственный сетевой запрос к API на весь сеанс работы с картой,
 * что помогает не тратить впустую суточные лимиты, установленные
 * Условиями использования отдельных сервисов «Яндекс Карт».
 *
 * Ключ получить бесплатно: https://developer.tech.yandex.ru/
 */
export function loadYandexMaps(apiKey: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Яндекс Карты можно загрузить только в браузере"));
  }
  if (window.ymaps) {
    return window.ymaps.ready().then(() => window.ymaps);
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      window.ymaps.ready().then(() => resolve(window.ymaps));
    };
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("Не удалось загрузить Яндекс Карты. Проверьте API-ключ и подключение к сети."));
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export {};
