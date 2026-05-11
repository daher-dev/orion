"use client";

import { CheckCircle2, CircleDashed, Send, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ShipmentStatus } from "@/lib/schemas/sewing";

/**
 * Mirrors `.pill` from the design's `/docs/design/source/styles.css`. Color
 * tokens come from globals.css:
 *   sent      → info (blue)
 *   received  → ok (green)
 *   partial   → warn (amber)
 *   cancelled → err (red)
 */

const STATUS_TONE: Record<ShipmentStatus, "info" | "ok" | "warn" | "err"> = {
  sent: "info",
  received: "ok",
  partial: "warn",
  cancelled: "err",
};

const STATUS_ICON: Record<ShipmentStatus, typeof Send> = {
  sent: Send,
  received: CheckCircle2,
  partial: CircleDashed,
  cancelled: XCircle,
};

const TONE_STYLE: Record<
  "info" | "ok" | "warn" | "err",
  { color: string; bg: string; border: string }
> = {
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
};

type Props = {
  status: ShipmentStatus;
};

export function ShipmentStatusPill({ status }: Props) {
  const t = useTranslations("sewing.status");
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
