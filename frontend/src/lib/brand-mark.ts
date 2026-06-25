/**
 * Orion mark geometry as plain SVG strings — shared by the React components'
 * sibling assets that can't import JSX: the generated app icons and OG image
 * (next/og rasterizes SVG via an <img> data URI). Source: the orbit symbol
 * (`#orbit-d` / `#orbit-s`) in /docs/design/Orion Brand.html (§02 — A marca).
 */

/** The orbit shapes (viewBox 0 0 24 24): two moons, the open orbit, the core. */
const ORION_ORBIT_SHAPES =
  '<circle cx="19" cy="5" r="2"/>' +
  '<circle cx="5" cy="19" r="2"/>' +
  '<path d="M10.4 21.9a10 10 0 0 0 9.941-15.416"/>' +
  '<path d="M13.5 2.1a10 10 0 0 0-9.841 15.416"/>' +
  '<circle cx="12" cy="12" r="3"/>';

/** The bare orbit mark, stroked in `color` (default Star). Square (viewBox 24×24). */
export function orionMarkSvg(width: number, color = "#f5efe0"): string {
  const sw = width <= 24 ? 2.2 : 1.6;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${ORION_ORBIT_SHAPES}</svg>`
  );
}

/**
 * The canonical app icon: an Ink rounded tile holding the Star orbit mark.
 * Resolution-independent (viewBox 0 0 100 100); `px` only sets the render box.
 * The 24-grid mark is scaled to ~62% (62/24 = 2.583) and centered.
 */
export function orionAppIconSvg(
  px = 100,
  { tile = "#1f1b15", mark = "#f5efe0" }: { tile?: string; mark?: string } = {},
): string {
  const s = 2.583;
  const t = 50 - 12 * s; // center the grid's (12,12) at (50,50) → ~19
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" rx="23" fill="${tile}"/>` +
    `<g transform="translate(${t} ${t}) scale(${s})" fill="none" stroke="${mark}" ` +
    `stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ORION_ORBIT_SHAPES}</g></svg>`
  );
}

/** Encode an SVG string as a base64 data URI for use as an <img> src in next/og. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
