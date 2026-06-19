"use client";

import { AlertTriangle, CheckCircle2, Copy, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UpsellerImportSummary } from "@/lib/schemas/orders-import";

type Props = {
  summary: UpsellerImportSummary;
};

/**
 * Counts panel for the dry-run preview. Surfaces the four numbers the
 * strict matcher returns: lines read, orders that will be created,
 * lines already imported (idempotency), and unmatched lines (which are
 * reported below and skipped).
 */
export function ImportSummaryPanel({ summary }: Props) {
  const t = useTranslations("ordersImport.review");
  const unmatched = summary.errors.length;

  const stats = [
    {
      key: "total",
      label: t("total"),
      value: summary.total,
      icon: FileText,
      tone: "var(--orion-ink-2)",
    },
    {
      key: "created",
      label: t("willCreate"),
      value: summary.created,
      icon: CheckCircle2,
      tone: "var(--brand-sales)",
    },
    {
      key: "duplicates",
      label: t("duplicates"),
      value: summary.skipped_duplicates,
      icon: Copy,
      tone: "var(--orion-ink-3)",
    },
    {
      key: "unmatched",
      label: t("unmatched"),
      value: unmatched,
      icon: AlertTriangle,
      tone: unmatched > 0 ? "var(--status-err)" : "var(--orion-ink-3)",
    },
  ] as const;

  return (
    <div
      data-testid="import-summary"
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
    >
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className="flex flex-col gap-1.5 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-4 py-3"
          >
            <div className="flex items-center gap-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
              <Icon size={13} strokeWidth={1.8} style={{ color: s.tone }} />
              {s.label}
            </div>
            <span
              className="font-serif text-[22px] font-medium tracking-[-0.01em] tabular-nums"
              style={{ color: s.tone }}
            >
              {s.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
