"use client";

import { useTranslations } from "next-intl";
import {
  confidenceBucket,
  formatConfidence,
  type ConfidenceBucket,
} from "@/lib/schemas/orders-import";

/**
 * Confidence pill — mirrors `.pill.{ok,warn,err,muted}` from the design's
 * `/docs/design/source/styles.css` (lines 419-436). Bucket thresholds:
 *
 *   score ≥ 0.8  → "high"   (green / .pill.ok)
 *   0.5 ≤ s <0.8 → "medium" (amber / .pill.warn)
 *   0 < s < 0.5  → "low"    (red   / .pill.err)
 *   missing / 0  → "none"   (muted ink-3)
 *
 * Renders the score itself (as a percentage) inside the pill so the
 * operator can sort and edit confidently.
 */
type Tone = "ok" | "warn" | "err" | "muted";

const BUCKET_TONE: Record<ConfidenceBucket, Tone> = {
  high: "ok",
  medium: "warn",
  low: "err",
  none: "muted",
};

const TONE_STYLE: Record<Tone, { color: string; bg: string; border: string }> = {
  ok: {
    color: "var(--status-ok)",
    bg: "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))",
    border: "color-mix(in oklab, var(--status-ok) 25%, var(--orion-surface))",
  },
  warn: {
    color: "var(--status-warn)",
    bg: "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
    border: "color-mix(in oklab, var(--status-warn) 25%, var(--orion-surface))",
  },
  err: {
    color: "var(--status-err)",
    bg: "color-mix(in oklab, var(--status-err) 14%, var(--orion-surface))",
    border: "color-mix(in oklab, var(--status-err) 25%, var(--orion-surface))",
  },
  muted: {
    color: "var(--orion-ink-3)",
    bg: "var(--orion-surface-2)",
    border: "var(--orion-line-soft)",
  },
};

type Props = {
  score: number | null | undefined;
};

export function ConfidenceChip({ score }: Props) {
  const t = useTranslations("ordersImport.confidence");
  const bucket = confidenceBucket(score);
  const tone = BUCKET_TONE[bucket];
  const style = TONE_STYLE[tone];
  const label = formatConfidence(score);

  return (
    <span
      data-testid={`confidence-${bucket}`}
      aria-label={t(bucket)}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5] whitespace-nowrap"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-[6px] w-[6px] rounded-full"
        style={{ background: "currentColor" }}
      />
      {label}
    </span>
  );
}
