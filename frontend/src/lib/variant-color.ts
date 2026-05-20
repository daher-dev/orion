/**
 * Variant color palette — mirrors `COLOR_HEX` /
 * `parseVariant` from `/docs/design/source/pages/sales.jsx` (lines 3-10).
 *
 * Each entry maps a 3-letter color code (BLK, GRN, ...) to its CSS hex so
 * we can render a real swatch next to the variation label, instead of the
 * generic ink-2 dot.
 */
const PALETTE: Record<string, string> = {
  BLK: "#1f1f1f",
  WHT: "#f4f1ea",
  OFW: "#efe6d3",
  BRN: "#7a4b2a",
  SND: "#cfb98e",
  GRN: "#3a4a3d",
  CRU: "#efe6d3",
  BEI: "#c9b9a3",
  RED: "#b03a2e",
};

/**
 * Returns a CSS color for a variant's color_code. Known codes use the
 * curated palette; unknown ones fall back to a deterministic HSL hash so
 * the swatch is at least stable across renders.
 */
export function variantColor(code: string | null | undefined): string {
  if (!code) return "var(--orion-ink-3)";
  const upper = code.toUpperCase();
  const hit = PALETTE[upper];
  if (hit) return hit;
  let hash = 0;
  for (let i = 0; i < upper.length; i++) {
    hash = upper.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 40%, 55%)`;
}
