/** Кастомные маркеры карты: свои SVG-пины вместо дефолтных точек Яндекса. */

function svgUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const GLYPH_Q = "M20 12c0-3.6 2.6-6 6-6s6 2.4 6 6c0 4.5-4 5.2-4 9h-4c0-3.4 4-4.4 4-7.4 0-1.5-1-2.6-2-2.6s-2 1.1-2 2.6l-4-1.6zM24 30.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z";
const GLYPH_CHAT = "M12 11h16v10H18l-4 4v-4h-2V11zm2 2v6h10v-6H14z";

export interface PinOpts {
  color: string;
  glyph?: "q" | "chat";
  photoUrl?: string | null;
  selected?: boolean;
}

export function makePin({ color, glyph = "q", photoUrl, selected = false }: PinOpts): string {
  const path = glyph === "q" ? GLYPH_Q : GLYPH_CHAT;
  const inner = photoUrl
    ? `<clipPath id="c"><circle cx="22" cy="22" r="13"/></clipPath><image href="${photoUrl}" xlink:href="${photoUrl}" x="9" y="9" width="26" height="26" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/><circle cx="22" cy="22" r="13" fill="none" stroke="#fff" stroke-width="3"/>`
    : `<g fill="#fff"><path d="${path}" transform="translate(-4,-4) scale(1)"/></g>`;
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

export const CLUSTER_SIZE: [number, number] = [64, 64];
export const CLUSTER_OFFSET: [number, number] = [-32, -32];

export const PIN_SIZE: [number, number] = [44, 48];
export const PIN_OFFSET: [number, number] = [-22, -44];
