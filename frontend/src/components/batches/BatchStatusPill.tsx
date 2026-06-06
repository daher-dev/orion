"use client";

import { CircleDot, Sliders, Printer, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BatchStatus } from "@/lib/schemas/batch";

type Tone = "muted" | "warn" | "info" | "ok" | "err";

const STATUS_TONE: Record<BatchStatus, Tone> = {
  open: "muted",
  adjusted: "warn",
  printed: "info",
  done: "ok",
  cancelled: "err",
};

const STATUS_ICON: Record<BatchStatus, typeof CircleDot> = {
  open: CircleDot,
  adjusted: Sliders,
  printed: Printer,
  done: CheckCircle2,
  cancelled: XCircle,
};

const TONE_STYLE: Record<Tone, { color: string; bg: string; border: string }> = {
  warn: {
    color: "var(--status-warn)",
    bg: "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
    border: "color-mix(in oklab, var(--status-warn) 25%, var(--orion-surface))",
  },
  info: {
    color: "var(--status-info)",
    bg: "color-mix(in oklab, var(--status-info) 14%, var(--orion-surface))",
    border: "color-mix(in oklab, var(--status-info) 25%, var(--orion-surface))",
  },
  ok: {
    color: "var(--status-ok)",
    bg: "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))",
    border: "color-mix(in oklab, var(--status-ok) 25%, var(--orion-surface))",
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

export function BatchStatusPill({ status }: { status: BatchStatus }) {
  const t = useTranslations("batches.statuses");
  const tone = STATUS_TONE[status];
  const Icon = STATUS_ICON[status];
  const style = TONE_STYLE[tone];
  return (
    <span
      data-testid={`batch-status-${status}`}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5] whitespace-nowrap"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {t(status)}
    </span>
  );
}
