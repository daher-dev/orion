/**
 * Orion mark geometry as plain SVG strings — shared by the React components'
 * sibling assets that can't import JSX: the generated app icons and OG image
 * (next/og rasterizes SVG via an <img> data URI). Source: the `orion-solid`
 * symbol in /docs/design/branding.html.
 */

/** Solid t-shirt silhouette path (viewBox 0 0 100 105); belt cut out (evenodd). */
export const ORION_SOLID_PATH =
  "M 42 16 C 38 18,28 19,22 22 L 9 41 C 8.5 42.5,9 44,10.5 44.5 L 26 49 L 22 88 " +
  "C 21.8 90,23.5 92,25.5 92 L 74.5 92 C 76.5 92,78.2 90,78 88 L 74 49 L 89.5 44.5 " +
  "C 91 44,91.5 42.5,91 41 L 78 22 C 72 19,62 18,58 16 C 56.5 22,53.5 28,50 28 " +
  "C 46.5 28,43.5 22,42 16 Z " +
  "M 40 56 m -3.6 0 a 3.6 3.6 0 1 0 7.2 0 a 3.6 3.6 0 1 0 -7.2 0 " +
  "M 50 58 m -4.2 0 a 4.2 4.2 0 1 0 8.4 0 a 4.2 4.2 0 1 0 -8.4 0 " +
  "M 60 56 m -3.6 0 a 3.6 3.6 0 1 0 7.2 0 a 3.6 3.6 0 1 0 -7.2 0";

/** The bare silhouette mark, `color` filled (default Star), aspect 100:105. */
export function orionMarkSvg(width: number, color = "#f5efe0"): string {
  const height = Math.round(width * 1.05);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 100 105"><path fill-rule="evenodd" fill="${color}" d="${ORION_SOLID_PATH}"/></svg>`
  );
}

/**
 * The canonical app icon: an Ink rounded tile holding the Star silhouette.
 * Resolution-independent (viewBox 0 0 100 100); `px` only sets the render box.
 * The mark is scaled to 0.62 and centered (its content center sits at ~50,54).
 */
export function orionAppIconSvg(
  px = 100,
  { tile = "#1f1b15", mark = "#f5efe0" }: { tile?: string; mark?: string } = {},
): string {
  const s = 0.62;
  const tx = 50 - s * 50; // 19
  const ty = 50 - s * 54; // 16.52
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" rx="23" fill="${tile}"/>` +
    `<g transform="translate(${tx} ${ty}) scale(${s})" fill="${mark}" fill-rule="evenodd">` +
    `<path d="${ORION_SOLID_PATH}"/></g></svg>`
  );
}

/** Encode an SVG string as a base64 data URI for use as an <img> src in next/og. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
