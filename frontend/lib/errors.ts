/**
 * FastAPI возвращает ошибки в разных формах: простая строка, объект
 * валидации Pydantic ({msg: ...}) или список таких объектов (422).
 * Эта функция приводит любой из вариантов к читаемой строке, чтобы
 * можно было безопасно вывести её в JSX (объект как children — краш React).
 */
export function getApiError(err: unknown, fallback = "Неизвестная ошибка"): string {
  const detail = (err as any)?.response?.data?.detail;

  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === "string" ? d : d?.msg)).filter(Boolean).join(", ") || fallback;
  }
  if (typeof detail === "object" && "msg" in detail) return String((detail as { msg: unknown }).msg);

  return fallback;
}
