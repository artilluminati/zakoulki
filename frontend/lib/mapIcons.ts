/** Кастомные маркеры карты: свои SVG-пины вместо дефолтных точек Яндекса. */

function svgUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GLYPH_CHAT_SVG = (color: string) =>
  `<rect x="12" y="11" width="20" height="14" rx="4" fill="#fff"/>` +
  `<path d="M17 24.5l-3.5 6.5 9-6.5z" fill="#fff"/>` +
  `<rect x="16" y="14.5" width="12" height="2.6" rx="1.3" fill="${color}"/>` +
  `<rect x="16" y="19" width="8" height="2.6" rx="1.3" fill="${color}"/>`;
const GLYPH_Q_TEXT = `<text x="22" y="30.5" text-anchor="middle" font-size="23" font-weight="800" font-family="system-ui,-apple-system,sans-serif" fill="#fff">?</text>`;

export interface PinOpts {
  color: string;
  glyph?: "q" | "chat";
  photoUrl?: string | null;
  selected?: boolean;
}

export function makePin({ color, glyph = "q", photoUrl, selected = false }: PinOpts): string {
  const inner = photoUrl
    ? `<clipPath id="c"><circle cx="22" cy="22" r="13"/></clipPath><image href="${photoUrl}" x="9" y="9" width="26" height="26" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/><circle cx="22" cy="22" r="13" fill="none" stroke="#fff" stroke-width="3"/>`
    : glyph === "q"
      ? GLYPH_Q_TEXT
      : GLYPH_CHAT_SVG(color);
  const ring = selected ? `<circle cx="22" cy="22" r="20" fill="none" stroke="#a3e635" stroke-width="3"/>` : "";
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="48" viewBox="0 0 44 48">` +
      `<ellipse cx="22" cy="44" rx="8" ry="2.5" fill="rgba(2,6,23,.25)"/>` +
      `<circle cx="22" cy="22" r="18" fill="${color}" stroke="#fff" stroke-width="3.5"/>` +
      inner + ring +
      `<path d="M22 40l-6 6 6-2 6 2z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>` +
      `</svg>`
  );
}

export const PIN_QUESTION = () => makePin({ color: "#059669", glyph: "q" });
export const PIN_OFFTOP = () => makePin({ color: "#64748b", glyph: "chat" });
export const PIN_SELECTED = () => makePin({ color: "#059669", glyph: "q", selected: true });

export const CLUSTER_ICON = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<ellipse cx="32" cy="60" rx="14" ry="3" fill="rgba(2,6,23,.25)"/>` +
    `<circle cx="32" cy="30" r="26" fill="#0f172a" stroke="#a3e635" stroke-width="4"/>` +
    `<circle cx="32" cy="30" r="26" fill="none" stroke="rgba(163,230,53,.30)" stroke-width="8"/>` +
    `</svg>`
);

/** Прозрачная заглушка 1px: сам кружок кластера рисует HTML-layout ниже,
 *  так цифра всегда в заливке независимо от загрузки картинки. */
export const CLUSTER_BLANK =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

export const CLUSTER_SIZE: [number, number] = [64, 64];
export const CLUSTER_OFFSET: [number, number] = [-32, -32];

export const PIN_SIZE: [number, number] = [44, 48];
export const PIN_OFFSET: [number, number] = [-22, -44];

/** Маленькая капля-пин для вершин территории и прочих мелких меток. */
export function makeDot(color = "#059669", label?: string): string {
  const inner = label
    ? `<text x="12" y="15.5" text-anchor="middle" font-size="10" font-weight="800" font-family="system-ui,-apple-system,sans-serif" fill="#fff">${label}</text>`
    : `<circle cx="12" cy="11" r="3.6" fill="#fff"/>`;
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">` +
      `<ellipse cx="12" cy="29.5" rx="5" ry="1.8" fill="rgba(2,6,23,.25)"/>` +
      `<path d="M12 1a10 10 0 0 1 10 10c0 7.5-10 19-10 19S2 18.5 2 11a10 10 0 0 1 10-10z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>` +
      inner +
      `</svg>`
  );
}

export const DOT_SIZE: [number, number] = [24, 32];
export const DOT_OFFSET: [number, number] = [-12, -30];
