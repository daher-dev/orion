import type { ReactNode } from "react";

/**
 * Rich-text tag maps for help popover bodies (`t.rich(...)`).
 *
 * Help body strings bold their key terms with `<b>…</b>`. A handful of pages
 * (planning) also colour two terms with `<sales>…</sales>` / `<warn>…</warn>`,
 * mirroring the prototype's inline-styled `<b>` tags.
 */

export const helpBodyTags = {
  b: (chunks: ReactNode) => <b>{chunks}</b>,
} as const;

export const helpBodyTagsPlanning = {
  b: (chunks: ReactNode) => <b>{chunks}</b>,
  sales: (chunks: ReactNode) => (
    <b style={{ color: "var(--brand-sales)" }}>{chunks}</b>
  ),
  warn: (chunks: ReactNode) => <b style={{ color: "var(--warn)" }}>{chunks}</b>,
} as const;
