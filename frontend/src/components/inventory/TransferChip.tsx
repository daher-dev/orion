/**
 * Striped art-chip standing in for a printed transfer — port of `TransferChip`
 * from the prototype `inventory-extra.jsx`. Renders the design `image_url` when
 * present, else a diagonally-striped placeholder with an image glyph.
 */
import { ImageIcon } from "lucide-react";

type Props = {
  imageUrl?: string | null;
  size?: number;
};

export function TransferChip({ imageUrl, size = 30 }: Props) {
  const accent = "var(--brand-inv)";
  if (imageUrl) {
    return (
      <span
        aria-hidden
        className="grid flex-shrink-0 place-items-center overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: 7,
          boxShadow: "inset 0 0 0 1px var(--orion-line-soft)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="grid flex-shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${accent} 12%, transparent) 0 3px, color-mix(in oklab, ${accent} 24%, transparent) 3px 6px)`,
        border: `1px solid color-mix(in oklab, ${accent} 25%, transparent)`,
        color: accent,
      }}
    >
      <ImageIcon size={Math.round(size * 0.42)} strokeWidth={1.6} />
    </span>
  );
}
