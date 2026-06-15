"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Whole-page empty state — port of the prototype `planejamento.jsx` `Empty`
 * block. Shown when both filtered columns are empty: a different body for the
 * "Tudo" filter (demand covered + nothing below minimum) vs a narrowed filter.
 */
type Props = {
  /** True when the active filter is "all" (demand + stock both covered). */
  isAllFilter: boolean;
};

export function PlanningEmptyState({ isAllFilter }: Props) {
  const t = useTranslations("planning.empty");
  return (
    <div
      data-testid="planning-empty"
      className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-[46px] text-center text-[color:var(--orion-ink-3)]"
    >
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)]">
        <CheckCircle2 size={24} strokeWidth={1.6} className="text-[color:var(--status-ok)]" />
      </div>
      <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("title")}</h3>
      <p className="mx-auto max-w-[360px] text-[13px] leading-[1.5]">
        {isAllFilter ? t("bodyAll") : t("bodyFiltered")}
      </p>
    </div>
  );
}
