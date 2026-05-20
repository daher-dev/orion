"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Billing features card — direct port of the "O que está incluído" card in
 * /docs/design/source/pages/settings.jsx (`BillingPane`, lines ~474-481).
 *
 * Layout:
 *  - .card shell (surface bg, line border, radius-lg) — header with title
 *    "O que está incluído" + sub "Recursos disponíveis no plano {plan}".
 *  - Body padding 14 / 18 / 18.
 *  - One row per feature: gap 10px, padding 8 0, 14px Check icon in --status-ok
 *    + 13.5px ink-2 label. Rows separated by 1px --orion-line-soft
 *    hairlines, last row has no border.
 */
type Props = {
  /** Plan name embedded in the subtitle copy. */
  planName: string;
};

export function BillingFeaturesCard({ planName }: Props) {
  const t = useTranslations("settings.billing.features");
  // The features list is sourced from the i18n bundle as a raw array — both
  // locales must hold the same array length (verified by scripts/i18n-lint.ts).
  const features = t.raw("items") as readonly string[];

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="billing-features-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub", { plan: planName })}
          </div>
        </div>
      </header>

      <ul className="px-[18px] pb-[18px] pt-[14px]">
        {features.map((feature, idx) => {
          const isLast = idx === features.length - 1;
          return (
            <li
              key={feature}
              className={
                "flex items-center gap-2.5 py-2 " +
                (isLast
                  ? ""
                  : "border-b border-[color:var(--orion-line-soft)]")
              }
            >
              <Check
                size={14}
                strokeWidth={2.6}
                className="shrink-0"
                style={{ color: "var(--status-ok)" }}
                aria-hidden
              />
              <span className="text-[13.5px] text-[color:var(--orion-ink-2)]">
                {feature}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
