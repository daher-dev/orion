import type { CSSProperties } from "react";

/**
 * A small round colour swatch — generalised from the inline dots in
 * `StockAdjustDialog` / the prototype `colorDotInv`. Blank pieces carry a
 * free-text colour name (no hex), so we map a handful of common pt-BR/EN
 * names to hexes and fall back to a neutral surface swatch otherwise.
 */
const NAMED_COLORS: Record<string, string> = {
  preto: "#1f1f1f",
  black: "#1f1f1f",
  branco: "#f4f1ea",
  white: "#f4f1ea",
  "off-white": "#efe6d3",
  offwhite: "#efe6d3",
  marrom: "#7a4b2a",
  brown: "#7a4b2a",
  areia: "#c9b9a3",
  sand: "#c9b9a3",
  bege: "#cfb98e",
  beige: "#cfb98e",
  "verde-musgo": "#7a8a76",
  "verde escuro": "#3a4a3d",
  verde: "#3a4a3d",
  green: "#3a4a3d",
  caramelo: "#6b4a2e",
  vermelho: "#b03a2e",
  red: "#b03a2e",
  "azul-marinho": "#2a3b5a",
  azul: "#2a3b5a",
  blue: "#2a3b5a",
  cru: "#d9cbb2",
  cinza: "#8a8580",
  gray: "#8a8580",
  grey: "#8a8580",
};

export function colorForName(name: string | null | undefined): string {
  if (!name) return "var(--orion-ink-3)";
  return NAMED_COLORS[name.trim().toLowerCase()] ?? "var(--orion-surface)";
}

type Props = {
  /** Colour name (free text) — mapped to a hex when known. */
  name?: string | null;
  /** Explicit hex overrides the name lookup. */
  hex?: string;
  size?: number;
  style?: CSSProperties;
};

export function ColorDot({ name, hex, size = 14, style }: Props) {
  const background = hex ?? colorForName(name);
  return (
    <span
      aria-hidden
      className="inline-block flex-shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background,
        boxShadow: "0 0 0 1px var(--orion-line), inset 0 0 0 1px rgba(255,255,255,.15)",
        ...style,
      }}
    />
  );
}
