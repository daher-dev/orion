"use client";

import { ReactNode } from "react";
import {
  CircleDollarSign,
  Inbox,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  canTransition,
  ORDER_TIMELINE_PHASES,
  phaseIndex,
  type OrderStatus,
} from "@/lib/schemas/order";

/**
 * Direct port of the `.ot` "Linha do tempo" rail from
 * `/docs/design/source/styles.css` (lines 1009-1064) and
 * `/docs/design/source/pages/sales.jsx` (line 409).
 *
 * The timeline draws four phases — pending → paid → shipped → delivered —
 * on a horizontal rail. The rail-fill width is `(phase / 3) * 100%`.
 * `cancelled` / `returned` are terminal and leave the rail unchanged but
 * are reflected via the surrounding status pill.
 */
type Props = {
  status: OrderStatus;
  /** Click handler used by the detail page to transition the status. */
  onSelect?: (next: OrderStatus) => void;
  /** Disable click interaction (read-only mode for Operators). */
  disabled?: boolean;
};

const PHASE_ICONS: Record<(typeof ORDER_TIMELINE_PHASES)[number], ReactNode> = {
  pending: <Inbox size={14} strokeWidth={1.8} />,
  paid: <CircleDollarSign size={14} strokeWidth={1.8} />,
  shipped: <Truck size={14} strokeWidth={1.8} />,
  delivered: <PackageCheck size={14} strokeWidth={1.8} />,
};

export function OrderStatusTimeline({ status, onSelect, disabled }: Props) {
  const t = useTranslations("orders.timeline");
  const idx = phaseIndex(status);
  // When the status is cancelled/returned we visually show the rail at
  // the deepest phase the order ever reached. Since we don't keep history,
  // we fall back to "no fill" for those terminal cases.
  const clampedIdx = idx < 0 ? -1 : idx;
  const fillWidth =
    clampedIdx < 0 ? "0%" : `${(clampedIdx / (ORDER_TIMELINE_PHASES.length - 1)) * 100}%`;

  return (
    <div
      data-testid="order-status-timeline"
      className="relative px-2 pt-1"
      style={{ ["--accent" as string]: "var(--brand-sales)", ["--accent-ink" as string]: "#fff" }}
    >
      {/* .ot-rail — absolute rail behind the dots. */}
      <div
        className="absolute left-8 right-8 top-6 h-[2px] rounded-full bg-[color:var(--orion-line)]"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{ width: fillWidth, background: "var(--brand-sales)" }}
        />
      </div>

      {/* .ot-steps — 4-column grid of dots + labels. */}
      <ol
        className="relative z-[1] grid grid-cols-4 gap-1"
        aria-label={t.has("statusTimeline") ? undefined : undefined}
      >
        {ORDER_TIMELINE_PHASES.map((phase, i) => {
          const done = clampedIdx >= 0 && i <= clampedIdx;
          const current = i === clampedIdx;
          const canClick =
            !disabled && onSelect && phase !== status && canTransition(status, phase);

          const dotClass = `grid h-9 w-9 place-items-center rounded-full border-[1.5px] transition-all`;
          const dotStyle = done
            ? {
                background: "var(--brand-sales)",
                borderColor: "var(--brand-sales)",
                color: "#fff",
                boxShadow: "0 2px 8px -2px var(--brand-sales)",
              }
            : {
                background: "var(--orion-surface)",
                borderColor: "var(--orion-line)",
                color: "var(--orion-ink-3)",
              };

          const currentOutline = current
            ? {
                boxShadow:
                  "0 0 0 4px color-mix(in oklab, var(--brand-sales) 22%, transparent), 0 2px 8px -2px var(--brand-sales)",
              }
            : undefined;

          const labelColor = done ? "var(--orion-ink)" : "var(--orion-ink-3)";
          const ariaLabel = t(phase);

          return (
            <li key={phase} className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={canClick ? () => onSelect?.(phase) : undefined}
                disabled={!canClick}
                aria-label={ariaLabel}
                aria-current={current ? "step" : undefined}
                data-testid={`timeline-step-${phase}`}
                data-current={current ? "true" : undefined}
                data-done={done ? "true" : undefined}
                className={canClick ? "cursor-pointer" : "cursor-default"}
                style={{ background: "transparent", border: 0, padding: 2 }}
              >
                <span
                  className={dotClass}
                  style={{ ...dotStyle, ...currentOutline }}
                  aria-hidden="true"
                >
                  {PHASE_ICONS[phase]}
                </span>
              </button>
              <div className="text-center">
                <div
                  className="text-[11.5px] font-medium leading-[1.2]"
                  style={{ color: labelColor }}
                >
                  {t(phase)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
