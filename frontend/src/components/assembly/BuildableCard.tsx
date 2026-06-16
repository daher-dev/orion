"use client";

import { Combine, Shirt, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { TransferChip } from "@/components/inventory/TransferChip";
import { ColorDot } from "@/components/inventory/ColorDot";
import { SideGlyph } from "@/components/inventory/SideGlyph";
import { GarmentGlyph } from "@/components/ui/garment-glyph";
import type { BuildableRow } from "@/lib/schemas/assembly";
import { CompLine } from "./CompLine";

/**
 * A buildable assist card — for one `(printed_transfer, blank)` pair with
 * on-hand. Shows the resulting SKU, the design thumb + side, the blank garment
 * (glyph + colour + size), both component on-hands, and a "Montar N" button
 * that assembles `max_buildable` units. Disabled when nothing is buildable.
 */

type Props = {
  row: BuildableRow;
  onBuild: (row: BuildableRow) => void;
  disabled?: boolean;
};

export function BuildableCard({ row, onBuild, disabled }: Props) {
  const t = useTranslations("assembly");
  const buildable = row.max_buildable;

  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)]" data-testid="buildable-card">
      <div className="p-3">
        {/* Header: max buildable + design thumb + garment/colour/size + SKU */}
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0 font-serif text-[24px] leading-none tabular-nums text-[color:var(--orion-ink)]">
            {buildable}
            <span className="text-[13px] text-[color:var(--orion-ink-3)]">×</span>
          </span>
          <TransferChip imageUrl={row.design.image_url} size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <GarmentGlyph productType={row.product_type} size={15} className="text-[color:var(--orion-ink-2)]" />
              <ColorDot name={row.blank.color} size={11} />
              <span className="truncate text-[12.5px] text-[color:var(--orion-ink)]">{row.blank.color}</span>
              <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">· {row.blank.size.toUpperCase()}</span>
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-[color:var(--orion-ink-3)]">{row.sku}</div>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1 text-[10.5px] text-[color:var(--orion-ink-3)]">
            <SideGlyph side={row.side} size={12} />
          </span>
        </div>

        {/* Component on-hands */}
        <div className="mt-[11px] grid gap-[7px]">
          <CompLine
            ok={row.blank.on_hand > 0}
            icon={<Shirt size={12} strokeWidth={2} />}
            label={t("comp.blank", { onHand: row.blank.on_hand })}
            qty={row.blank.on_hand}
          />
          <CompLine
            ok={row.printed_on_hand > 0}
            icon={<Stamp size={12} strokeWidth={2} />}
            label={t("comp.printed", { onHand: row.printed_on_hand })}
            qty={row.printed_on_hand}
          />
        </div>
      </div>

      <button
        type="button"
        data-testid="buildable-build"
        disabled={disabled || buildable <= 0}
        onClick={() => onBuild(row)}
        className="flex w-full items-center justify-center gap-1.5 border-t border-[color:var(--orion-line-soft)] py-2.5 text-[12.5px] font-medium transition-colors disabled:cursor-default disabled:opacity-50"
        style={{
          background: buildable > 0 ? "color-mix(in oklab, var(--brand-prod) 10%, var(--orion-bg))" : "var(--orion-bg)",
          color: buildable > 0 ? "var(--brand-prod)" : "var(--orion-ink-3)",
        }}
      >
        <Combine size={13} strokeWidth={1.8} />
        {t("actions.build", { n: buildable })}
      </button>
    </div>
  );
}
