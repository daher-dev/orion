import type { SVGProps } from "react";

/**
 * Orion belt loader — the three belt stars (Mintaka · Alnilam · Alnitak). When
 * animated they pulse left→right as the app's canonical loading indicator
 * (brand variant C); the animation lives in globals.css (.belt-loader) and is
 * disabled under prefers-reduced-motion.
 *
 * Set `animated={false}` for the static three-star glyph (e.g. the "by Orion"
 * attribution mark). Colour follows `currentColor`.
 */
export type BeltLoaderProps = {
  /** Width in px (the belt is 3:1, so height ≈ size / 3). */
  size?: number;
  /** Accessible label; when omitted the mark is decorative (aria-hidden). */
  label?: string;
  /** Pulse animation (default true). Disable for a static attribution glyph. */
  animated?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height">;

export function BeltLoader({
  size = 48,
  label,
  animated = true,
  className,
  style,
  ...props
}: BeltLoaderProps) {
  return (
    <svg
      className={(animated ? "belt-loader " : "") + (className ?? "")}
      width={size}
      height={size / 3}
      viewBox="0 0 30 10"
      style={{ overflow: "visible", ...style }}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      <circle cx="5" cy="5" r="3" fill="currentColor" />
      <circle cx="15" cy="5" r="3.6" fill="currentColor" />
      <circle cx="25" cy="5" r="3" fill="currentColor" />
    </svg>
  );
}
