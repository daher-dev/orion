"use client";

import { Layers, Rows3, Scissors, TrendingUp, Wrench } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCuttingCost } from "@/hooks/use-cutting";
import type { CuttingOrder, CuttingRunCost } from "@/lib/schemas/cutting";

type Props = {
  order: CuttingOrder;
};

const SECTION_CLASS =
  "mb-[10px] mt-[18px] border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

/**
 * Collapsible "Custo" breakdown rendered on the cutting detail sheet, shown
 * only when the order is `done` and its frozen cost row has been computed.
 *
 * Visual: stacked rows (fabric, ribana, trims, labor) each with icon, label,
 * a small sub-line, and a right-aligned BRL value; a surface-2 total bar; and
 * an accent footnote carrying the per-piece cost and yield (pieces/kg). Ports
 * the cost-breakdown card from `docs/design/pages/catalog.jsx` (Custo tab).
 */
export function CuttingCostSection({ order }: Props) {
  const t = useTranslations("cutting.cost");
  const format = useFormatter();
  const query = useCuttingCost(order.id, order.status);

  // Nothing to show until the order is done and the cost has been computed.
  // A 404 (not-yet-computed) and any error simply render nothing.
  if (order.status !== "done" || !query.data) return null;

  const cost: CuttingRunCost = query.data;

  const brl = (v: number) => format.number(v, { style: "currency", currency: "BRL" });
  const kg = (v: number) =>
    format.number(v, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const num = (v: number, digits = 2) =>
    format.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const rows: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    sub: string;
    value: number;
    show: boolean;
  }> = [
    {
      key: "fabric",
      icon: <Layers size={14} strokeWidth={1.6} />,
      label: t("fabric"),
      sub: t("fabricSub", { kg: kg(cost.body_fabric_kg), price: brl(cost.body_price_per_kg) }),
      value: cost.fabric_cost,
      show: true,
    },
    {
      key: "ribana",
      icon: <Rows3 size={14} strokeWidth={1.6} />,
      label: t("ribana"),
      sub: t("ribanaSub", {
        kg: kg(cost.ribana_kg),
        price: brl(cost.rib_price_per_kg ?? cost.body_price_per_kg),
      }),
      value: cost.ribana_cost,
      // Only show the ribana row when this run actually consumed ribana.
      show: cost.ribana_kg > 0 || cost.ribana_cost > 0,
    },
    {
      key: "trims",
      icon: <Scissors size={14} strokeWidth={1.6} />,
      label: t("trims"),
      sub: t("trimsSub", { pieces: cost.total_pieces }),
      value: cost.trims_cost,
      show: true,
    },
    {
      key: "labor",
      icon: <Wrench size={14} strokeWidth={1.6} />,
      label: t("labor"),
      sub: t("laborSub", { pieces: cost.total_pieces }),
      value: cost.labor_cost,
      show: true,
    },
  ];

  return (
    <div data-testid="cutting-cost-section">
      <div className={SECTION_CLASS}>{t("title")}</div>
      <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
        <div className="grid gap-px bg-[color:var(--orion-line-soft)]">
          {rows
            .filter((r) => r.show)
            .map((r) => (
              <div
                key={r.key}
                className="flex items-center gap-3 bg-[color:var(--orion-surface)] px-[14px] py-[12px]"
              >
                <span className="text-[color:var(--orion-ink-3)]">{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-[color:var(--orion-ink)]">{r.label}</div>
                  <div className="truncate text-[11px] text-[color:var(--orion-ink-3)]">
                    {r.sub}
                  </div>
                </div>
                <div
                  className="font-medium text-[color:var(--orion-ink)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {brl(r.value)}
                </div>
              </div>
            ))}
          {/* Total bar — surface-2, display-font BRL. */}
          <div className="flex items-center justify-between bg-[color:var(--orion-surface-2)] px-[14px] py-[12px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
              {t("total")}
            </span>
            <span
              className="font-serif text-[22px] text-[color:var(--orion-ink)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {brl(cost.total_cost)}
            </span>
          </div>
        </div>
      </div>

      {/* Accent footnote — per-piece cost + yield. */}
      <div
        className="mt-3 flex items-center gap-2 rounded-[8px] px-3 py-3 text-[12px] text-[color:var(--orion-ink-2)]"
        style={{ background: "color-mix(in oklab, var(--brand-prod) 8%, var(--orion-surface))" }}
      >
        <TrendingUp size={14} strokeWidth={1.8} />
        <span>{t("perPiece", { value: brl(cost.cost_per_piece) })}</span>
        <span
          className="ml-auto font-medium text-[color:var(--orion-ink)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {t("yield", { value: num(cost.yield_pieces_per_kg, 3) })}
        </span>
      </div>
    </div>
  );
}
