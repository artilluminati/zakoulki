import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// FastAPI отдаёт загруженные фото статикой на /uploads, а не под префиксом
// /api — вычисляем origin бэкенда один раз, чтобы строить абсолютные ссылки.
export const apiOrigin = API_URL.replace(/\/api\/?$/, "");

export function photoUrl(fileName: string): string {
  return `${apiOrigin}/uploads/${fileName}`;
}

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
