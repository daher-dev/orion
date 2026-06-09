"use client";

import { useTranslations } from "next-intl";
import type { UsageMetric } from "@/lib/schemas/billing";

/**
 * Billing usage grid — renders one card per plan limit (members, orders/month,
 * integrations, storage), reusing the 6px progress-bar markup from the original
 * `BillingUsageCard`. Driven entirely by the `UsageMetric[]` array from
 * `GET /v1/billing/summary`.
 *
 * Per-metric behaviour:
 *  - `limit === null` → unlimited: no warn color, bar shown at a muted partial
 *    fill, "of unlimited" caption.
 *  - `tracked === false` → Orion doesn't model this dimension yet (integrations,
 *    storage): the big number is replaced by a "Not tracked yet" label and the
 *    bar is rendered empty/muted, so the UI never shows a fabricated number.
 *  - otherwise → real `used / limit`, warn color above 80%, "limit reached" copy
 *    at the cap.
 *
 * Follows docs/design/pages/settings.jsx BillingPane (the "Uso da equipe" card).
 */
type Props = {
  usage: readonly UsageMetric[];
};

export function BillingUsageGrid({ usage }: Props) {
  return (
    <div
      className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
      data-testid="billing-usage-grid"
    >
      {usage.map((metric) => (
        <UsageCard key={metric.key} metric={metric} />
      ))}
    </div>
  );
}

function UsageCard({ metric }: { metric: UsageMetric }) {
  const t = useTranslations("settings.billing.grid");
  const { key, used, limit, tracked } = metric;

  const unlimited = limit === null;
  // Only compute a meaningful percentage for tracked, bounded metrics.
  const pct = !tracked
    ? 0
    : unlimited
      ? 8 // small muted indicator for unlimited
      : limit === 0
        ? 100
        : Math.min(100, (used / limit) * 100);
  const warn = tracked && !unlimited && pct > 80;
  const atLimit = tracked && !unlimited && limit !== null && used >= limit && limit > 0;

  const ofCaption = unlimited ? t("ofUnlimited") : t("of", { max: limit ?? 0 });

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="billing-usage-card"
      data-metric={key}
    >
      <header className="border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t(`metric.${key}`)}
        </div>
      </header>

      <div className="px-[18px] pb-[18px] pt-[14px]">
        <div className="mb-[14px] flex items-baseline gap-2">
          {tracked ? (
            <>
              <span
                className="font-serif text-[40px] font-normal leading-none tracking-[-0.025em] text-[color:var(--orion-ink)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
                data-testid="billing-usage-count"
              >
                {used}
              </span>
              <span
                className="text-[14px] text-[color:var(--orion-ink-3)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {ofCaption}
              </span>
            </>
          ) : (
            <span
              className="text-[14px] font-medium text-[color:var(--orion-ink-3)]"
              data-testid="billing-usage-untracked"
            >
              {t("notTracked")}
            </span>
          )}
        </div>

        <div
          className="h-[6px] overflow-hidden rounded-full bg-[color:var(--orion-bg)]"
          role="progressbar"
          aria-valuenow={tracked ? used : undefined}
          aria-valuemin={0}
          aria-valuemax={limit ?? undefined}
          aria-label={t(`metric.${key}`)}
        >
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: tracked ? `${pct}%` : "0%",
              opacity: unlimited ? 0.5 : 1,
              background: warn ? "var(--status-warn)" : "var(--sidebar-primary)",
            }}
            data-testid="billing-usage-fill"
            data-warn={warn || undefined}
            data-unlimited={unlimited || undefined}
          />
        </div>

        <div className="mt-3 text-[12px] leading-[1.5] text-[color:var(--orion-ink-3)]">
          {!tracked
            ? t("notTracked")
            : unlimited
              ? t("unlimited")
              : atLimit
                ? t("limitReached")
                : null}
        </div>
      </div>
    </div>
  );
}
