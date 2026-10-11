/** Свои хосты: ссылки вида HOST/thread/123 и HOST/hub/45 рисуем чипами.
 * При переезде на другой домен — дописать сюда (бэк: INTERNAL_HOSTS в markdown.py). */

export const INTERNAL_HOSTS = ["zakoulki.serveousercontent.com"];

export interface InternalLink { kind: "thread" | "hub"; id: number; }

/** Распознать ссылку на свой пост/раздел (полную или относительную). */
export function parseInternalLink(href: string): InternalLink | null {
  const m = href.match(/^(?:https?:\/\/([^/\s]+))?\/(thread|hub)\/(\d+)/i);
  if (!m) return null;
  if (m[1] && !INTERNAL_HOSTS.includes(m[1].toLowerCase())) return null;
  return { kind: m[2].toLowerCase() as "thread" | "hub", id: Number(m[3]) };
}
