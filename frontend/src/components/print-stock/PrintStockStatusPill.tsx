"use client";

import { useTranslations } from "next-intl";

type Props = {
  onHand: number;
  threshold?: number;
};

/**
 * Pill chip showing whether a printed-stamp (estampa, colour) is low or ok.
 * Below or equal to `threshold` → "low" (amber); above → "ok" (green).
 * Visual port of `.pill.warn` / `.pill.ok`.
 */
export function PrintStockStatusPill({ onHand, threshold = 5 }: Props) {
  const t = useTranslations("printStock.statuses");
  const isLow = onHand <= threshold;
  const status = isLow ? "low" : "ok";
  const palette = isLow
    ? {
        color: "var(--status-warn)",
        bg: "color-mix(in oklab, var(--status-warn) 12%, var(--orion-surface))",
        border: "color-mix(in oklab, var(--status-warn) 25%, var(--orion-surface))",
      }
    : {
        color: "var(--status-ok)",
        bg: "color-mix(in oklab, var(--status-ok) 12%, var(--orion-surface))",
        border: "color-mix(in oklab, var(--status-ok) 25%, var(--orion-surface))",
      };

  return (
    <span
      data-testid={`print-stock-status-pill-${status}`}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5]"
      style={{ color: palette.color, background: palette.bg, borderColor: palette.border }}
    >
      <span aria-hidden className="size-[6px] rounded-full" style={{ background: "currentColor" }} />
      {t(status)}
    </span>
  );
}
