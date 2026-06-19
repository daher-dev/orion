"use client";

import {
  AlertCircle,
  Box,
  Boxes,
  CheckCircle2,
  Clock,
  FileText,
  Package,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConferenceTotals } from "@/lib/schemas/dashboard";

type Tile = { key: string; icon: LucideIcon; color: string; value: number };

/**
 * "Relatório de pedidos" — an 8-tile breakdown of today's order book, all
 * derived from `conference.totals`. Port of the `report-grid` block in
 * dashboard.jsx.
 */
export function OrderReportGrid({ totals }: { totals: ConferenceTotals }) {
  const t = useTranslations("dashboard.report");

  const tiles: Tile[] = [
    { key: "orders", icon: FileText, color: "var(--sidebar-primary)", value: totals.orders },
    { key: "pieces", icon: Package, color: "var(--brand-catalog)", value: totals.pieces },
    { key: "mapped", icon: Tag, color: "var(--status-ok)", value: totals.mapped },
    { key: "pending", icon: AlertCircle, color: "var(--status-warn)", value: totals.pending },
    { key: "done", icon: CheckCircle2, color: "var(--status-ok)", value: totals.orders_checked },
    {
      key: "tocheck",
      icon: Clock,
      color: "var(--orion-ink-3)",
      value: totals.orders - totals.orders_checked,
    },
    { key: "inbatch", icon: Boxes, color: "var(--brand-catalog)", value: totals.in_lote },
    {
      key: "nobatch",
      icon: Box,
      color: "var(--orion-ink-3)",
      value: totals.orders - totals.in_lote,
    },
  ];

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="order-report"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </div>
        </div>
      </div>

      <div className="px-[18px] py-[18px]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            // Mirrors the design: only a zero *pending* greys out; other tiles
            // keep their accent even at zero.
            const valueColor =
              tile.value === 0 && tile.key === "pending"
                ? "var(--orion-ink-3)"
                : tile.color;
            return (
              <div
                key={tile.key}
                data-testid="report-tile"
                className="rounded-[10px] border px-[16px] py-[14px]"
                style={{
                  background: `color-mix(in oklab, ${tile.color} 6%, var(--orion-surface))`,
                  borderColor: `color-mix(in oklab, ${tile.color} 18%, var(--orion-surface))`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="grid h-7 w-7 place-items-center rounded-[7px]"
                    style={{
                      background: `color-mix(in oklab, ${tile.color} 14%, var(--orion-surface))`,
                      color: tile.color,
                    }}
                  >
                    <Icon size={14} strokeWidth={2.2} />
                  </span>
                  <span
                    className="font-serif text-[30px] leading-none"
                    style={{ color: valueColor, fontVariantNumeric: "tabular-nums" }}
                  >
                    {tile.value.toLocaleString()}
                  </span>
                </div>
                <div className="mt-[9px] text-[12px] font-medium text-[color:var(--orion-ink-3)]">
                  {t(`tiles.${tile.key}`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
