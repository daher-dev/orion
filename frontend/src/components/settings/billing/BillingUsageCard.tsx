"use client";

import { useTranslations } from "next-intl";
import { useMembers } from "@/hooks/use-members";

/**
 * Billing usage card — direct port of the "Uso da equipe" card in
 * /docs/design/source/pages/settings.jsx (`BillingPane`, lines ~453-471).
 *
 * Layout:
 *  - .card shell (surface bg, line border, radius-lg) — separate header band
 *    with title "Uso da equipe" (16px Fraunces 500 -.01em) + sub "Membros
 *    com acesso à sua conta" (12px ink-3 mt 2).
 *  - Body padding 14 / 18 / 18 / 18.
 *  - Big number: Fraunces 40 / 400 / -0.025em / lh 1 / tabular-nums.
 *  - "de {max} pessoas" — 14px ink-3 / tabular-nums, baseline aligned with
 *    the big number, 8px gap. Wrapped in mb 14.
 *  - Progress bar: 6px high on a --orion-bg track, fill in --status-warn if
 *    pct > 80 else --sidebar-primary (our --accent equivalent). Width
 *    transitions at 0.3s.
 *  - Footer copy: 12px ink-3 / lh 1.5 / mt 12. Plural copy via ICU plural
 *    syntax. When max is reached, renders the "limite atingido" string.
 *
 * The members count comes from the existing `useMembers` hook
 * (`data.total`). When the query is pending we render a 0 placeholder so the
 * layout doesn't jump; on error we still surface seed values to keep the
 * pane usable. Max is currently hardcoded to 10 until the billing backend
 * lands — TODO wire real plan limit when the backend exposes it.
 */
type Props = {
  /** Cap on members for the active plan. */
  maxMembers: number;
};

export function BillingUsageCard({ maxMembers }: Props) {
  const t = useTranslations("settings.billing.usage");
  const members = useMembers();
  // TODO wire real plan limit when billing backend lands.
  const count = members.data?.total ?? 0;
  const pct = Math.min(100, (count / maxMembers) * 100);
  const remaining = Math.max(0, maxMembers - count);
  const overLimit = remaining === 0;

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="billing-usage-card"
    >
      {/* .card-head — flex row, padding 14 18, soft hairline at the bottom. */}
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </div>
        </div>
      </header>

      {/* Card body — matches Card pad rule (14 / 18 / 18). */}
      <div className="px-[18px] pb-[18px] pt-[14px]">
        {/* Big number row — Fraunces 40px / 400 / -0.025em / lh 1 +
            "de {max} pessoas" 14px ink-3, baseline aligned, gap 8px, mb 14. */}
        <div className="mb-[14px] flex items-baseline gap-2">
          <span
            className="font-serif text-[40px] font-normal leading-none tracking-[-0.025em] text-[color:var(--orion-ink)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
            data-testid="billing-usage-count"
          >
            {count}
          </span>
          <span
            className="text-[14px] text-[color:var(--orion-ink-3)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {t("of", { max: maxMembers })}
          </span>
        </div>

        {/* Progress bar — 6px high on --orion-bg track. Fill width transitions
            at .3s; color switches to --status-warn above 80%. */}
        <div
          className="h-[6px] overflow-hidden rounded-full bg-[color:var(--orion-bg)]"
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={maxMembers}
          aria-label={t("title")}
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              background:
                pct > 80 ? "var(--status-warn)" : "var(--sidebar-primary)",
            }}
            data-testid="billing-usage-fill"
            data-warn={pct > 80 || undefined}
          />
        </div>

        {/* Footer copy — 12px ink-3 / lh 1.5 / mt 12. Inline <b> elevates the
            remaining count to ink-2 (matches the design's <b style="color:
            var(--ink-2)">). */}
        <div className="mt-3 text-[12px] leading-[1.5] text-[color:var(--orion-ink-3)]">
          {overLimit ? (
            t("limitReached")
          ) : (
            t.rich("remaining", {
              count: remaining,
              b: (chunks) => (
                <b className="font-semibold text-[color:var(--orion-ink-2)]">
                  {chunks}
                </b>
              ),
            })
          )}
        </div>
      </div>
    </div>
  );
}
