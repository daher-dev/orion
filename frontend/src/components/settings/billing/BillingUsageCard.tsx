"use client";

import { useTranslations } from "next-intl";

/**
 * Billing usage card — a single members-usage card, port of the "Uso da equipe"
 * card in /docs/design/source/pages/settings.jsx (`BillingPane`).
 *
 * Plan-driven: both the current `count` and the `maxMembers` cap are passed in
 * as props (the page sources them from `GET /v1/billing/summary`). This
 * component no longer calls `useMembers` — usage now flows from the billing
 * summary so the number and the cap always agree with the resolved plan.
 *
 * Layout:
 *  - .card shell with a header band (title + sub), then a 40px Fraunces count,
 *    "of {max} people" caption, a 6px progress bar (warn color > 80%), and a
 *    footer line with remaining-seats / limit-reached copy.
 *  - `maxMembers === null` → unlimited plan: the bar is muted and the footer
 *    shows nothing about a cap.
 */
type Props = {
  /** Current member count from the billing summary. */
  count: number;
  /** Cap on members for the active plan. `null` means unlimited. */
  maxMembers: number | null;
};

export function BillingUsageCard({ count, maxMembers }: Props) {
  const t = useTranslations("settings.billing.usage");
  const unlimited = maxMembers === null;
  const pct = unlimited ? 8 : maxMembers === 0 ? 100 : Math.min(100, (count / maxMembers) * 100);
  const remaining = unlimited ? Infinity : Math.max(0, maxMembers - count);
  const overLimit = !unlimited && remaining === 0;
  const warn = !unlimited && pct > 80;

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="billing-usage-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">{t("sub")}</div>
        </div>
      </header>

      <div className="px-[18px] pb-[18px] pt-[14px]">
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
            {t("of", { max: maxMembers ?? "∞" })}
          </span>
        </div>

        <div
          className="h-[6px] overflow-hidden rounded-full bg-[color:var(--orion-bg)]"
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={maxMembers ?? undefined}
          aria-label={t("title")}
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${pct}%`,
              opacity: unlimited ? 0.5 : 1,
              background: warn ? "var(--status-warn)" : "var(--sidebar-primary)",
            }}
            data-testid="billing-usage-fill"
            data-warn={warn || undefined}
          />
        </div>

        <div className="mt-3 text-[12px] leading-[1.5] text-[color:var(--orion-ink-3)]">
          {unlimited ? null : overLimit ? (
            t("limitReached")
          ) : (
            t.rich("remaining", {
              count: remaining,
              b: (chunks) => (
                <b className="font-semibold text-[color:var(--orion-ink-2)]">{chunks}</b>
              ),
            })
          )}
        </div>
      </div>
    </div>
  );
}
