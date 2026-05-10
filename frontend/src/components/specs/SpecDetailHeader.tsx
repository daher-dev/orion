import { type ReactNode } from "react";

/**
 * Page header shared by the Specs list, detail and form pages.
 *
 * Mirrors the design source's `.page-head` rhythm:
 *   - .page-eyebrow — 11px / 0.12em / uppercase / 600, brand-catalog mark
 *   - .page-eyebrow-mark — 18×18, radius 4, brand-catalog bg, white serif glyph
 *   - .page-title — Fraunces 30px / 400 / -0.025em / line-height 1.05
 *   - .page-sub — ink-3, 13px, max-w 60ch
 */
export function SpecDetailHeader({
  eyebrow,
  title,
  sub,
  actions,
  eyebrowGlyph = "C",
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  eyebrowGlyph?: string;
}) {
  return (
    <header className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-catalog)]"
          data-testid="spec-page-eyebrow"
        >
          <span
            aria-hidden="true"
            className="grid h-[18px] w-[18px] place-items-center rounded-[4px] bg-[color:var(--brand-catalog)] font-serif text-[10px] font-semibold text-white"
            data-testid="spec-page-eyebrow-mark"
          >
            {eyebrowGlyph}
          </span>
          {eyebrow}
        </span>
        <h1
          className="font-serif text-[30px] font-normal leading-[1.05] tracking-[-0.025em] text-[color:var(--orion-ink)]"
          data-testid="spec-page-title"
        >
          {title}
        </h1>
        {sub ? (
          <p className="max-w-[60ch] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">{sub}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
