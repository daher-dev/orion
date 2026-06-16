import type { CSSProperties } from "react";
import type { PrintSide } from "@/lib/schemas/printed-transfer";

/**
 * Garment-side glyph — direct port of `SideGlyph` from the prototype
 * `inventory-extra.jsx`. A panel with a chest-print mark (frente / front) or a
 * spine seam (costas / back).
 */
type Props = {
  side: PrintSide;
  size?: number;
  color?: string;
  style?: CSSProperties;
};

export function SideGlyph({ side, size = 14, color = "var(--orion-ink-3)", style }: Props) {
  const back = side === "back";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M8.5 3.5 L5 5.5 L5 20.5 L19 20.5 L19 5.5 L15.5 3.5" />
      <path d="M8.5 3.5 Q12 6.5 15.5 3.5" />
      {back ? (
        <line x1="12" y1="8" x2="12" y2="18" />
      ) : (
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill={color} stroke="none" />
      )}
    </svg>
  );
}
