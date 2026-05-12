"use client";

import { useTranslations } from "next-intl";
import type { PipelineCounts } from "@/lib/schemas/dashboard";

type Props = { pipeline: PipelineCounts };

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
      <div className="mb-3">
        <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("title")}
        </h2>
        <p className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
          {t("sub")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className="flex flex-col gap-2 rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-4 py-3"
            style={{ borderTop: `3px solid ${stage.accent}` }}
          >
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
              {stage.label}
            </span>
            <span
              className="font-serif text-[26px] font-normal leading-none text-[color:var(--orion-ink)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {pipeline[stage.key]}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] italic text-[color:var(--orion-ink-3)]">
        {t("footer")}
      </p>
    </section>
  );
}
