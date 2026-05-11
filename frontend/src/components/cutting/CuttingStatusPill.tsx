"use client";

import { CheckCircle2, Clock, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CuttingStatus } from "@/lib/schemas/cutting";

/**
 * Mirrors `.pill` / `.pill.{ok,info,warn,err}` from the design's
 * `/docs/design/source/styles.css`. Color tokens come from globals.css:
 *   warn → amber (--status-warn)  — pending
 *   info → deep blue (--status-info) — cutting
 *   ok   → green (--status-ok)    — done
 */

const STATUS_TONE: Record<CuttingStatus, "warn" | "info" | "ok"> = {
  pending: "warn",
  cutting: "info",
  done: "ok",
};

const STATUS_ICON: Record<CuttingStatus, typeof Clock> = {
  pending: Clock,
  cutting: Scissors,
  done: CheckCircle2,
};

// Each tone maps to a color token + matching ink-on-tint background.
// `color-mix` is used to soften the tint to ~16% of the brand color over the
// page surface, which matches the design's `--*-bg` tokens.
const TONE_STYLE: Record<
  "warn" | "info" | "ok",
  { color: string; bg: string; border: string }
> = {
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
};

type Props = {
  status: CuttingStatus;
};

export function CuttingStatusPill({ status }: Props) {
  const t = useTranslations("cutting.status");
  const tone = STATUS_TONE[status];
  const Icon = STATUS_ICON[status];
  const style = TONE_STYLE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5]"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {t(status)}
    </span>
  );
}
