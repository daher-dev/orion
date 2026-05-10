import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PageHeadProps = {
  /** CSS variable name for the sub-product accent (e.g. `var(--brand-prod)`). */
  subColor: string;
  /** Translated eyebrow label, e.g. "Production". */
  eyebrow: string;
  /** Lucide icon shown inside the 18×18 eyebrow mark. */
  EyebrowIcon: LucideIcon;
  /** Translated title head — rendered in serif, weight 400. */
  title: string;
  /** Optional italic+colored emphasis suffix, rendered as `<em>`. */
  titleEm?: string;
  /** Optional subtitle paragraph (max-w 60ch). */
  description?: string;
  /** Right-aligned action slot (typically a primary Button). */
  actions?: ReactNode;
};

/**
 * Page header — direct port of `.page-head` from the design source.
 *
 * Pixel rules (verbatim from `/docs/design/source/styles.css`):
 *   - .page-eyebrow-mark: 18×18, radius 4, sub-color bg, white 10px serif glyph.
 *   - .page-eyebrow:      11px uppercase, letter-spacing .12em, sub-color text.
 *   - .page-title:        Fraunces 30px / weight 400 / tracking -.025em / lh 1.05.
 *   - .page-title em:     italic, sub-color text.
 *   - .page-sub:          13px / ink-3 / max-w 60ch.
 *   - container gap: 6px column.
 */
export function PageHead({
  subColor,
  eyebrow,
  EyebrowIcon,
  title,
  titleEm,
  description,
  actions,
}: PageHeadProps) {
  return (
    <div
      className="mb-[22px] flex flex-wrap items-end justify-between gap-6"
      style={{ ["--orion-sub-color" as string]: subColor }}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--orion-sub-color)" }}
        >
          <span
            className="grid h-[18px] w-[18px] place-items-center rounded-[4px] text-white"
            style={{ background: "var(--orion-sub-color)" }}
          >
            <EyebrowIcon size={11} strokeWidth={2.2} />
          </span>
          {eyebrow}
        </div>
        <h1
          className="font-serif text-[30px] font-normal leading-[1.05] tracking-[-0.025em] text-[color:var(--orion-ink)]"
        >
          {title}
          {titleEm ? (
            <>
              {" "}
              <em
                className="font-normal italic"
                style={{ color: "var(--orion-sub-color)" }}
              >
                {titleEm}
              </em>
            </>
          ) : null}
        </h1>
        {description ? (
          <p className="max-w-[60ch] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
