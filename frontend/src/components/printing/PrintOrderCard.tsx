"use client";

import { Scroll } from "lucide-react";
import { useTranslations } from "next-intl";
import { TransferChip } from "@/components/inventory/TransferChip";
import { InkDot } from "@/components/inventory/InkDot";
import { SideGlyph } from "@/components/inventory/SideGlyph";
import { sumPrintOutputs, type PrintOrder } from "@/lib/schemas/print-order";

/**
 * Kanban card for a print order — port of the Impressão card in
 * `printing.jsx`. Header: design thumb + name + technique pill + faded code.
 * Body: one row per `(variation, side)` output with an ink dot, side glyph
 * (when the design is two-sided), printed/planned counts + a progress bar.
 * Footer: the attached paper roll code.
 */

type Props = {
  order: PrintOrder;
  onClick: () => void;
};

export function PrintOrderCard({ order, onClick }: Props) {
  const t = useTranslations("printOrders");
  const twoSided = order.design.technique !== "silkscreen" && order.outputs.some((o) => o.side === "back");
  const planned = sumPrintOutputs(order.outputs, "planned_quantity");
  const printed = sumPrintOutputs(order.outputs, "printed_quantity");

  // Show rows with a non-zero plan, sorted variation then side.
  const rows = order.outputs
    .filter((o) => o.planned_quantity > 0)
    .sort((a, b) => a.variation.name.localeCompare(b.variation.name) || a.side.localeCompare(b.side));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background: "var(--orion-bg)",
        border: "1px solid var(--orion-line-soft)",
        borderRadius: "var(--radius-sm)",
        padding: 12,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <TransferChip imageUrl={order.design.image_url} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-[14px] text-[color:var(--orion-ink)]">
            {order.design.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-1.5 py-px text-[10px] uppercase text-[color:var(--orion-ink-3)]">
              {t(`techniques.${order.design.technique}`)}
            </span>
          </div>
        </div>
        <span className="font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">{order.code}</span>
      </div>

      {/* Variation rows */}
      <div className="mt-[11px] grid gap-[9px]">
        {rows.map((r) => {
          const pct = r.planned_quantity > 0 ? Math.min(100, (r.printed_quantity / r.planned_quantity) * 100) : 0;
          const done = r.planned_quantity > 0 && r.printed_quantity >= r.planned_quantity;
          return (
            <div key={`${r.print_design_variation_id}-${r.side}`} className="flex items-center gap-[9px]">
              <span className="grid size-[22px] flex-shrink-0 place-items-center rounded-[6px] bg-[color:var(--orion-surface-2)]">
                <InkDot ink={r.variation.ink_hex} size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-[12.5px] font-medium text-[color:var(--orion-ink)]">
                    {r.variation.name}
                  </span>
                  {twoSided ? (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 text-[10.5px] text-[color:var(--orion-ink-3)]">
                      <SideGlyph side={r.side} size={11} />
                    </span>
                  ) : null}
                  <span
                    className="ml-auto flex-shrink-0 font-serif text-[12.5px] tabular-nums"
                    style={{ color: done ? "var(--status-ok)" : "var(--orion-ink)" }}
                  >
                    {r.printed_quantity}
                    <span className="text-[color:var(--orion-ink-3)]">/{r.planned_quantity}</span>
                  </span>
                </div>
                <div
                  className="mt-[5px] overflow-hidden rounded-full"
                  style={{ height: 4, background: "var(--orion-line-soft)" }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: done ? "var(--status-ok)" : "var(--brand-prod)",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 ? (
          <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">{t("card.noPlan")}</span>
        ) : null}
      </div>

      {/* Footer: total + roll code */}
      <div className="mt-[11px] flex items-center gap-3 border-t border-[color:var(--orion-line-soft)] pt-[9px] text-[11px] text-[color:var(--orion-ink-3)]">
        <span className="tabular-nums">
          {printed}/{planned} {t("card.printed")}
        </span>
        {order.paper_roll ? (
          <span className="ml-auto inline-flex items-center gap-1 font-mono">
            <Scroll size={12} strokeWidth={1.6} />
            {order.paper_roll.code}
          </span>
        ) : null}
      </div>
    </div>
  );
}
