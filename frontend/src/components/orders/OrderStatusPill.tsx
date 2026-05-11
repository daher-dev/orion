"use client";

import {
  Clock,
  CircleDollarSign,
  PackageCheck,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { OrderStatus } from "@/lib/schemas/order";

/**
 * Mirrors `.pill` / `.pill.{ok,info,warn,err,muted}` from the design's
 * `/docs/design/source/styles.css` (lines 419-436). Tone selection
 * matches the design source `STATUS_MAP` in `ui.jsx`:
 *
 *   pending  → warn  (amber)
 *   paid     → info  (deep blue)
 *   shipped  → info  (deep blue)
 *   delivered→ ok    (green)
 *   cancelled→ err   (red)
 *   returned → muted (ink-3)
 */
type Tone = "warn" | "info" | "ok" | "err" | "muted";

const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "warn",
  paid: "info",
  shipped: "info",
  delivered: "ok",
  cancelled: "err",
  returned: "muted",
};

const STATUS_ICON: Record<OrderStatus, typeof Clock> = {
  pending: Clock,
  paid: CircleDollarSign,
  shipped: Truck,
  delivered: PackageCheck,
  cancelled: XCircle,
  returned: Undo2,
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

type Props = {
  status: OrderStatus;
  ariaLabel?: string;
};

/** Re-usable order status pill. Reads its label from `orders.statuses.*`. */
export function OrderStatusPill({ status, ariaLabel }: Props) {
  const t = useTranslations("orders.statuses");
  const tone = STATUS_TONE[status];
  const Icon = STATUS_ICON[status];
  const style = TONE_STYLE[tone];
  return (
    <span
      data-testid={`order-status-${status}`}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5] whitespace-nowrap"
      style={{ color: style.color, background: style.bg, borderColor: style.border }}
    >
      <Icon size={11} strokeWidth={2.2} />
      {t(status)}
    </span>
  );
}
