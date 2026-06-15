"use client";

import { CheckCircle2, Clock, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PrintOrderStatus } from "@/lib/schemas/print-order";

/**
 * Status pill for print orders — mirrors `CuttingStatusPill` tones:
 *   warn (amber) → pending · info (blue) → printing · ok (green) → done.
 */

const STATUS_TONE: Record<PrintOrderStatus, "warn" | "info" | "ok"> = {
  pending: "warn",
  printing: "info",
  done: "ok",
};

const STATUS_ICON: Record<PrintOrderStatus, typeof Clock> = {
  pending: Clock,
  printing: Printer,
  done: CheckCircle2,
};

const TONE_STYLE: Record<"warn" | "info" | "ok", { color: string; bg: string; border: string }> = {
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
  status: PrintOrderStatus;
};

export function PrintOrderStatusPill({ status }: Props) {
  const t = useTranslations("printOrders.status");
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
