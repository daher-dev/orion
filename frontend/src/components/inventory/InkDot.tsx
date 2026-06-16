import type { CSSProperties } from "react";

/**
 * A small round ink-colour swatch for estampa variations — port of `InkDot`
 * from the prototype `printing.jsx`. Takes an explicit hex (variations always
 * carry `ink_hex`), unlike `ColorDot` which maps free-text colour names.
 */
type Props = {
  ink?: string | null;
  size?: number;
  style?: CSSProperties;
};

export function InkDot({ ink, size = 13, style }: Props) {
  return (
    <span
      aria-hidden
      className="inline-block flex-shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: ink || "var(--orion-ink-3)",
        boxShadow: "0 0 0 1px var(--orion-line), inset 0 0 0 1px rgba(255,255,255,.18)",
        ...style,
      }}
    />
  );
}
