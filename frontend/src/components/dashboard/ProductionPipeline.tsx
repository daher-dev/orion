"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PipelineCounts } from "@/lib/schemas/dashboard";

type Props = { pipeline: PipelineCounts };

/**
 * Horizontal 5-stage production pipeline visual. Each stage is a card with
 * a stage label and a count. Stages are separated by a small chevron.
 */
export function ProductionPipeline({ pipeline }: Props) {
  const t = useTranslations("dashboard.pipeline");

  const stages: Array<{ key: keyof PipelineCounts; accent: string; label: string }> = [
    { key: "total_pending_orders", accent: "var(--brand-sales)", label: t("stages.pendingOrders") },
    { key: "in_cutting", accent: "var(--brand-prod)", label: t("stages.inCutting") },
    { key: "in_sewing", accent: "var(--brand-prod)", label: t("stages.inSewing") },
    { key: "in_stock", accent: "var(--brand-inv)", label: t("stages.inStock") },
    { key: "shipped_30d", accent: "var(--brand-sales)", label: t("stages.shipped30d") },
  ];

  return (
    <section className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
      <h2 className="mb-3 font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
        {t("title")}
      </h2>
      <div className="flex flex-wrap items-stretch gap-2">
        {stages.map((stage, idx) => (
          <div key={stage.key} className="flex items-center gap-2">
            <div
              className="flex min-w-[120px] flex-col gap-1 rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2.5"
              style={{ borderLeft: `3px solid ${stage.accent}` }}
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {stage.label}
              </span>
              <span
                className="font-serif text-[22px] font-normal leading-none text-[color:var(--orion-ink)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {pipeline[stage.key]}
              </span>
            </div>
            {idx < stages.length - 1 ? (
              <ChevronRight className="size-4 text-[color:var(--orion-ink-3)]" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
