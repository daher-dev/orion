"use client";

import { Fragment } from "react";
import { Check, Factory, GitMerge, PackageCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import type { Order } from "@/lib/schemas/order";

/**
 * The per-order pipeline rail shown in the order detail sheet (port of
 * `separacao.jsx` `ItemJourney`). Four steps derived from the readiness flags:
 *   Mapeado   ← !has_unmapped_items
 *   Produzido ← ready (finished stock covers it)
 *   Separado  ← batch_id != null (in a lote)
 *   Enviado   ← status === shipped
 */
const STEPS: { key: string; icon: LucideIcon }[] = [
  { key: "mapped", icon: GitMerge },
  { key: "produced", icon: Factory },
  { key: "separated", icon: PackageCheck },
  { key: "shipped", icon: Truck },
];

export function OrderJourney({ order }: { order: Order }) {
  const t = useTranslations("orders.journey");
  const done: boolean[] = [
    !order.has_unmapped_items,
    order.ready,
    order.batch_id != null,
    order.status === "shipped" || order.status === "delivered",
  ];
  const current = done.indexOf(false);

  return (
    <div
      className="mt-3 flex items-start"
      data-testid={`order-journey-${order.id}`}
    >
      {STEPS.map((step, i) => {
        const isDone = done[i];
        const isCurrent = i === current;
        const color = isDone
          ? "var(--status-ok)"
          : isCurrent
            ? "var(--brand-prod)"
            : "var(--orion-ink-3)";
        const bg = isDone
          ? "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))"
          : isCurrent
            ? "color-mix(in oklab, var(--brand-prod) 12%, var(--orion-surface))"
            : "var(--orion-surface-2)";
        const StepIcon = step.icon;
        return (
          <Fragment key={step.key}>
            <div className="flex w-[60px] flex-shrink-0 flex-col items-center gap-[5px]">
              <span
                className="grid h-[30px] w-[30px] place-items-center rounded-full border"
                style={{
                  background: bg,
                  color,
                  borderColor: `color-mix(in oklab, ${color} 28%, var(--orion-surface))`,
                }}
              >
                {isDone ? (
                  <Check size={15} strokeWidth={2.4} />
                ) : (
                  <StepIcon size={15} strokeWidth={1.8} />
                )}
              </span>
              <span
                className="whitespace-nowrap text-center text-[10px]"
                style={{
                  color: isDone
                    ? "var(--status-ok)"
                    : isCurrent
                      ? "var(--orion-ink)"
                      : "var(--orion-ink-3)",
                  fontWeight: isDone || isCurrent ? 600 : 400,
                }}
              >
                {t(step.key)}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className="mt-[14px] h-[2px] flex-1 rounded-full"
                style={{
                  background: isDone ? "var(--status-ok)" : "var(--orion-line)",
                }}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
