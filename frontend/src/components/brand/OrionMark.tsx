import type { SVGProps } from "react";

/**
 * The Orion symbol — a t-shirt silhouette whose vertices are stars, with
 * Orion's belt across the chest. Direct port of the `orion-solid` /
 * `orion-display` symbols from /docs/design/branding.html.
 *
 * Two variants, per the brand system:
 *  - "solid"         — the filled silhouette with the three belt stars cut out
 *                      (fill-rule evenodd). The ONLY variant that survives below
 *                      56px: favicon, app icon, sidebar, small UI.
 *  - "constellation" — the full 14-star mark with halos + connecting lines.
 *                      Display use only, ≥ 56px (hero, covers, print).
 *
 * Monochrome by default via `currentColor`; the constellation draws the belt
 * in Ember (the one chromatic accent the mark may take — brand rule #3) unless
 * `mono` is set.
 */
export type OrionMarkProps = {
  variant?: "solid" | "constellation";
  /** Rendered box size in px (width = height; art is centered in a 100×105 box). */
  size?: number;
  /** Constellation only: draw the belt in the mark colour instead of Ember. */
  mono?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height">;

// Single-path t-shirt silhouette; the three `M … a …` sub-paths are the belt
// stars, cut out via fill-rule evenodd.
const SOLID_PATH =
  "M 42 16 C 38 18,28 19,22 22 L 9 41 C 8.5 42.5,9 44,10.5 44.5 L 26 49 L 22 88 " +
  "C 21.8 90,23.5 92,25.5 92 L 74.5 92 C 76.5 92,78.2 90,78 88 L 74 49 L 89.5 44.5 " +
  "C 91 44,91.5 42.5,91 41 L 78 22 C 72 19,62 18,58 16 C 56.5 22,53.5 28,50 28 " +
  "C 46.5 28,43.5 22,42 16 Z " +
  "M 40 56 m -3.6 0 a 3.6 3.6 0 1 0 7.2 0 a 3.6 3.6 0 1 0 -7.2 0 " +
  "M 50 58 m -4.2 0 a 4.2 4.2 0 1 0 8.4 0 a 4.2 4.2 0 1 0 -8.4 0 " +
  "M 60 56 m -3.6 0 a 3.6 3.6 0 1 0 7.2 0 a 3.6 3.6 0 1 0 -7.2 0";

// Outline stars tracing the silhouette: [cx, cy, haloRadius, dotRadius].
const OUTLINE_STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [42, 20, 4.4, 2.4],
  [23, 25, 5.4, 2.9],
  [12, 43, 3.8, 2.0],
  [32, 41, 3.2, 1.7],
  [28, 86, 5.4, 2.9],
  [72, 86, 5.4, 2.9],
  [68, 41, 3.2, 1.7],
  [88, 43, 3.8, 2.0],
  [77, 25, 5.4, 2.9],
  [58, 20, 4.4, 2.4],
  [50, 26, 2.8, 1.5],
];

// Orion's belt — Mintaka · Alnilam · Alnitak: [cx, cy, haloRadius, dotRadius].
const BELT_STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [40, 56, 5.4, 2.4],
  [50, 58, 6.2, 2.7],
  [60, 56, 5.4, 2.4],
];

export function OrionMark({ variant = "solid", size = 24, mono = false, ...props }: OrionMarkProps) {
  if (variant === "solid") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 105" {...props}>
        <path fillRule="evenodd" fill="currentColor" d={SOLID_PATH} />
      </svg>
    );
  }

  const beltColor = mono ? "currentColor" : "var(--ember)";
  return (
    <svg width={size} height={size} viewBox="0 0 100 105" {...props}>
      <radialGradient id="orion-disp-glow" cx="50%" cy="55%" r="55%">
        <stop offset="0%" stopColor="currentColor" stopOpacity={0.08} />
        <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
      </radialGradient>
      <circle cx="50" cy="55" r="50" fill="url(#orion-disp-glow)" />
      {/* T-shirt outline traced through the 11 corner stars */}
      <polyline
        points="42,20 23,25 12,43 32,41 28,86 72,86 68,41 88,43 77,25 58,20 50,26 42,20"
        fill="none"
        stroke="currentColor"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
      {/* Orion's belt — chest emblem */}
      <polyline
        points="40,56 50,58 60,56"
        fill="none"
        stroke={beltColor}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.7}
      />
      <g fill="currentColor">
        {OUTLINE_STARS.map(([cx, cy, halo, dot]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={halo} opacity={0.1} />
            <circle cx={cx} cy={cy} r={dot} />
          </g>
        ))}
      </g>
      <g fill={beltColor}>
        {BELT_STARS.map(([cx, cy, halo]) => (
          <circle key={`halo-${cx}`} cx={cx} cy={cy} r={halo} opacity={0.1} />
        ))}
        {BELT_STARS.map(([cx, cy, , dot]) => (
          <circle key={`dot-${cx}`} cx={cx} cy={cy} r={dot} />
        ))}
      </g>
    </svg>
  );
}
