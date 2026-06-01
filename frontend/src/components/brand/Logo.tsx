import type { ReactNode } from "react";
import { OrionMark } from "./OrionMark";
import { Wordmark } from "./Wordmark";

/**
 * Orion app-icon tile — the canonical small-format mark: an Ink rounded square
 * holding the Star silhouette. This is the favicon / app icon / sidebar / auth
 * treatment ("Star sobre Carvão" from the brand sheet). Fixed colours: the
 * mark identity does not take the UI accent.
 */
export function OrionTile({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const radius = Math.max(6, Math.round(size * 0.23));
  return (
    <span
      aria-hidden
      className={
        "grid shrink-0 place-items-center bg-[color:var(--orion-ink)] text-[color:var(--star)] " +
        (className ?? "")
      }
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
      }}
    >
      <OrionMark variant="solid" size={Math.round(size * 0.64)} />
    </span>
  );
}

/**
 * The Orion logo lockups (brand sheet section 04):
 *  - "horizontal" (A) — tile + wordmark side by side.
 *  - "stacked"    (B) — tile above the wordmark, centered.
 *  - "mark"       (C) — the tile only.
 *  - "wordmark"   (D) — the wordmark only.
 * Pass `tagline` for lockup E.
 */
export type LogoProps = {
  layout?: "horizontal" | "stacked" | "mark" | "wordmark";
  /** Tile size in px; the wordmark scales with it. */
  size?: number;
  tagline?: ReactNode;
  className?: string;
};

export function Logo({ layout = "horizontal", size = 32, tagline, className }: LogoProps) {
  const wordmarkSize = Math.round(size * 0.6);

  if (layout === "mark") {
    return <OrionTile size={size} className={className} />;
  }
  if (layout === "wordmark") {
    return <Wordmark size={wordmarkSize} tagline={tagline} className={className} />;
  }
  if (layout === "stacked") {
    return (
      <span className={"inline-flex flex-col items-center gap-3 " + (className ?? "")}>
        <OrionTile size={size} />
        <Wordmark size={wordmarkSize} tagline={tagline} />
      </span>
    );
  }
  return (
    <span className={"inline-flex items-center gap-2.5 " + (className ?? "")}>
      <OrionTile size={size} />
      <Wordmark size={wordmarkSize} tagline={tagline} />
    </span>
  );
}
