import type { CSSProperties, ReactNode } from "react";

/**
 * Page header — direct port of `.page-head` from /docs/design/source/styles.css.
 *
 * Layout: flex, align-end, justify-between, gap 24px, mb 22px, wraps on narrow.
 * Left column: eyebrow (mark + uppercase 11px label) + 30px serif title + 13px sub.
 * Right column: action buttons in an 8px-gap row.
 *
 * The `subColor` prop drives the eyebrow's `--sub-color` CSS var so the badge
 * + title `<em>` adopt the section's brand (terracotta for Sales, etc.).
 */
export type PageHeadProps = {
  /** Mark glyph rendered inside the 18×18 rounded-4 brand-colored chip. */
  mark: ReactNode;
  /** Uppercase 11px tracking-.12em label next to the mark, e.g. "Vendas". */
  eyebrow: ReactNode;
  /** Page title — Fraunces 30px weight 400 tracking -.025em line-height 1.05. */
  title: ReactNode;
  /** Optional emphasised italic suffix (rendered with brand color, weight 400). */
  titleEm?: ReactNode;
  /** 13px ink-3 max-w-60ch subtitle. */
  sub?: ReactNode;
  /** Optional action buttons block on the right (e.g. "Novo cliente"). */
  actions?: ReactNode;
  /** CSS var or hex driving the eyebrow chip + emphasised title color. */
  subColor: string;
};

export function PageHead({
  mark,
  eyebrow,
  title,
  titleEm,
  sub,
  actions,
  subColor,
}: PageHeadProps) {
  // .page-head — design source: align-end, gap 24px, mb 22px, wrap.
  return (
    <div
      className="mb-[22px] flex flex-wrap items-end justify-between gap-x-6 gap-y-3"
      style={{ "--sub-color": subColor } as CSSProperties}
    >
      {/* .page-head-l — column, gap 6px. */}
      <div className="flex min-w-0 flex-col gap-1.5">
        {/* .page-eyebrow — 11px, tracking .12em, uppercase, font-semibold (600). */}
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--sub-color)]">
          {/* .page-eyebrow-mark — 18×18, rounded-4, brand bg, white 10px display glyph. */}
          <span
            className="grid h-[18px] w-[18px] place-items-center rounded-[4px] font-serif text-[10px] font-semibold text-white"
            style={{ background: "var(--sub-color)" }}
          >
            {mark}
          </span>
          {eyebrow}
        </div>
        {/* .page-title — Fraunces 30px / 400 / -.025em / lh 1.05 / ink. */}
        <h1 className="font-serif text-[30px] font-normal leading-[1.05] tracking-[-0.025em] text-[color:var(--orion-ink)]">
          {title}
          {titleEm ? (
            <>
              {" "}
              <em
                className="font-serif font-normal italic"
                style={{ color: "var(--sub-color)" }}
              >
                {titleEm}
              </em>
            </>
          ) : null}
        </h1>
        {/* .page-sub — 13px ink-3, max-w 60ch. */}
        {sub ? (
          <div className="max-w-[60ch] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">
            {sub}
          </div>
        ) : null}
      </div>
      {/* .page-head-r — 8px gap, wraps. */}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
