"use client";

import { useTranslations } from "next-intl";

type Props = {
  onHand: number;
  threshold?: number;
};

/**
 * Pill chip showing whether a SKU is low or ok.
 *
 * Below or equal to `threshold` (default 5) → "low" (amber).
 * Above → "ok" (green).
 *
 * Visual: copy of `.pill.warn` / `.pill.ok` from styles.css.
 */
export function StockStatusPill({ onHand, threshold = 5 }: Props) {
  const t = useTranslations("stock.statuses");
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
      data-testid={`stock-status-pill-${status}`}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5]"
      style={{
        color: palette.color,
        background: palette.bg,
        borderColor: palette.border,
      }}
    >
      <span
        aria-hidden
        className="size-[6px] rounded-full"
        style={{ background: "currentColor" }}
      />
      {t(status)}
    </span>
  );
}
