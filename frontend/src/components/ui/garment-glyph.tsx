import * as React from "react";

/**
 * Garment glyphs — direct port of the SVG paths from
 * `/docs/design/source/pages/catalog.jsx` (GARMENT_GLYPHS).
 *
 * Glyphs are purely decorative. There are four silhouette shapes; the eight
 * backend `ProductType` garment values (camiseta, moletom, regata, blusa,
 * calca, bermuda, ecobag, cropped) each map onto one of them via
 * `GLYPH_ALIASES`. The shape keys below are an internal detail — the public
 * `productType` prop accepts any garment identifier and is resolved through
 * `garmentGlyphType`.
 */

/** Internal silhouette keys — NOT the public garment enum. */
type GlyphKey = "tshirt" | "sweatshirt" | "shorts" | "tanktop";

type Props = React.SVGProps<SVGSVGElement> & {
  /** Any garment identifier (backend `ProductType`, glyph key, …). */
  productType: string;
  size?: number;
};

const PATHS: Record<GlyphKey, React.ReactNode> = {
  tshirt: (
    <path d="M8 3 L5 5 L3 8 L5 10 L7 9 L7 21 L17 21 L17 9 L19 10 L21 8 L19 5 L16 3 C16 5 14.5 6 12 6 C9.5 6 8 5 8 3 Z" />
  ),
  sweatshirt: (
    <>
      <path d="M9 7 Q12 2 15 7" />
      <path d="M9 7 L6 8 L3 11 L5.5 13 L7 12 L7 20 Q7 21 8 21 L16 21 Q17 21 17 20 L17 12 L18.5 13 L21 11 L18 8 L15 7" />
      <path d="M11.2 7 L11.2 11 M12.8 7 L12.8 11" />
      <path d="M7 18 L17 18" />
    </>
  ),
  tanktop: (
    <path d="M8 3 L6 10 L6 21 L18 21 L18 10 L16 3 L14 3 C14 5 13 6 12 6 C11 6 10 5 10 3 Z" />
  ),
  shorts: (
    <>
      <path d="M5 4 L19 4 L19 9 L17 16 L13 16 L12 11 L10 11 L9 16 L7 16 L5 9 Z" />
      <path d="M5 7 L19 7" />
    </>
  ),
};

/**
 * Resolve any garment identifier — the frontend `ProductType` (`tshirt`…) OR the
 * backend `ProductType` enum value (`camiseta`, `moletom`, `regata`, `calca`,
 * `bermuda`, `ecobag`, `cropped`…) — to a glyph-safe key. The glyph is purely
 * decorative, so unknown garments fall back to the t-shirt silhouette rather
 * than crashing on a missing path.
 */
const GLYPH_ALIASES: Record<string, GlyphKey> = {
  tshirt: "tshirt",
  sweatshirt: "sweatshirt",
  shorts: "shorts",
  tanktop: "tanktop",
  // Backend garment-type enum values.
  camiseta: "tshirt",
  cropped: "tshirt",
  blusa: "tshirt",
  ecobag: "tshirt",
  moletom: "sweatshirt",
  regata: "tanktop",
  bermuda: "shorts",
  calca: "shorts",
};

export function garmentGlyphType(value: string | null | undefined): GlyphKey {
  if (!value) return "tshirt";
  return GLYPH_ALIASES[value.toLowerCase()] ?? "tshirt";
}

export function GarmentGlyph({ productType, size = 14, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[garmentGlyphType(productType)]}
    </svg>
  );
}
