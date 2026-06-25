import type { SVGProps } from "react";

/**
 * The Orion symbol — "um sistema em órbita": a planet core (r3) with two moons
 * (r2) on a diagonal and an open orbit drawn as two r10 arcs, on a 24-unit
 * grid. Direct port of the `#orbit-d` / `#orbit-s` symbols from
 * /docs/design/Orion Brand.html (§02 — A marca).
 *
 * Two variants, per the brand system:
 *  - "mono"   — the whole mark in `currentColor` (Ink on Paper, or Star on
 *               dark). The default — 90% of appearances.
 *  - "accent" — the core filled with Ember (the one chromatic accent the mark
 *               may take, brand rule §07); moons + orbit stay `currentColor`.
 *               For hero / cover / brand moments.
 *
 * Stroke is 1.6 at display sizes and 2.2 at small/UI sizes (≤ 24px), matching
 * the brand sheet's two symbols; pass `weight` to force one.
 */
export type OrionMarkProps = {
  variant?: "mono" | "accent";
  /** Rendered box size in px (width = height; art is a 24×24 grid). */
  size?: number;
  /** Force the stroke weight; defaults to "ui" (2.2) at ≤24px else "display" (1.6). */
  weight?: "display" | "ui";
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height">;

export function OrionMark({ variant = "mono", size = 24, weight, ...props }: OrionMarkProps) {
  const strokeWidth = weight === "display" ? 1.6 : weight === "ui" ? 2.2 : size <= 24 ? 2.2 : 1.6;
  const coreFill = variant === "accent" ? "var(--ember)" : "none";
  const coreStroke = variant === "accent" ? "var(--ember)" : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* two moons, on the diagonal */}
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      {/* open orbit — two arcs that never close */}
      <path d="M10.4 21.9a10 10 0 0 0 9.941-15.416" />
      <path d="M13.5 2.1a10 10 0 0 0-9.841 15.416" />
      {/* core — drawn last so the Ember fill sits above the orbit */}
      <circle cx="12" cy="12" r="3" fill={coreFill} stroke={coreStroke} />
    </svg>
  );
}
