import type { ReactNode } from "react";

/**
 * The Orion wordmark — "Orion" in Fraunces 400 with tight tracking, where the
 * dot of the "i" carries Orion's belt: the natural i-dot is Alnilam, flanked
 * by two pseudo-dots (.wm-belt-l / .wm-belt-r) that complete the three-star
 * belt. Styling lives in globals.css (.orion-wordmark / .wm-i); this component
 * only sets the font size so the belt dots scale in `em`.
 *
 * Exposed as role="img" named "Orion" so the split Or/i/on spans read as one
 * word to assistive tech. Direct port of the wordmark + lockup from
 * /docs/design/branding.html.
 */
const NAMED_SIZES = { xl: 128, lg: 64, md: 36, sm: 22, xs: 16 } as const;

export type WordmarkProps = {
  /** A named scale or an explicit px font size. */
  size?: keyof typeof NAMED_SIZES | number;
  /** Optional tagline rendered beneath the wordmark (lockup E). */
  tagline?: ReactNode;
  className?: string;
};

export function Wordmark({ size = "md", tagline, className }: WordmarkProps) {
  const fontSize = typeof size === "number" ? size : NAMED_SIZES[size];

  // Kept on one line so the rendered text content is exactly "Orion" (no stray
  // whitespace from JSX), which keeps text-based queries/assertions simple.
  const wordmark = (
    <span
      className={"orion-wordmark" + (tagline || !className ? "" : " " + className)}
      style={tagline ? undefined : { fontSize }}
      role="img"
      aria-label="Orion"
    >
      Or<span className="wm-i">i<span className="wm-belt-l" aria-hidden /><span className="wm-belt-r" aria-hidden /></span>on
    </span>
  );

  if (!tagline) return wordmark;

  // Stacked lockup: tagline font size + tracking are relative to the wordmark.
  return (
    <span
      className={"inline-flex flex-col gap-1.5 leading-none " + (className ?? "")}
      style={{ fontSize }}
    >
      {wordmark}
      <span className="pl-[0.05em] font-sans text-[0.13em] font-medium uppercase tracking-[0.28em] text-[color:var(--orion-ink-3)]">
        {tagline}
      </span>
    </span>
  );
}
