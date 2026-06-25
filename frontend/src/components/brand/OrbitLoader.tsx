import type { SVGProps } from "react";

/**
 * Orion orbit loader — the mark's two moons orbit the fixed core (brand
 * variant D from /docs/design/Orion Brand.html §02). The app's canonical
 * loading indicator: splash, busy buttons, sync. The rotation lives in
 * globals.css (.orbit-spin-group) and is disabled under prefers-reduced-motion.
 *
 * Set `animated={false}` for the static orbit glyph (e.g. the "by Orion"
 * attribution mark). Colour follows `currentColor`.
 */
export type OrbitLoaderProps = {
  /** Rendered box size in px (square, 24×24 grid). */
  size?: number;
  /** Accessible label; when omitted the mark is decorative (aria-hidden). */
  label?: string;
  /** Orbit animation (default true). Disable for a static attribution glyph. */
  animated?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height">;

export function OrbitLoader({ size = 48, label, animated = true, ...props }: OrbitLoaderProps) {
  const strokeWidth = size <= 24 ? 2.2 : 1.6;
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
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {/* core stays fixed */}
      <circle cx="12" cy="12" r="3" />
      {/* two moons + open orbit rotate around the core */}
      <g className={animated ? "orbit-spin-group" : undefined}>
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <path d="M10.4 21.9a10 10 0 0 0 9.941-15.416" />
        <path d="M13.5 2.1a10 10 0 0 0-9.841 15.416" />
      </g>
    </svg>
  );
}
