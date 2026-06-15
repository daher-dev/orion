"use client";

import { Package, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { type AvailableCut } from "@/lib/schemas/cutting";

type Props = {
  cut: AvailableCut;
  onCreate: (cut: AvailableCut) => void;
};

/**
 * One available-cut card in the Costura "Disponível" column — a DONE cutting
 * order with remaining (un-sent) pieces. Port of the prototype's `availableCuts`
 * card (production.jsx lines 944–973): spec glyph + colour, per-size boxes with
 * the available count, total pieces, and a "Nova remessa" foot button that
 * opens the form pre-filled with this cutting order.
 */
export function SewingAvailableCard({ cut, onCreate }: Props) {
  const t = useTranslations("sewing.available");

  return (
    <div
      data-testid="sewing-available-card"
      role="button"
      tabIndex={0}
      onClick={() => onCreate(cut)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCreate(cut);
        }
      }}
      className="cursor-pointer overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-[color:var(--brand-prod)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]"
    >
      <div className="p-3">
        {/* Head: spec name + colour (port of CardHead glyph title sub) */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11.5px] text-[color:var(--orion-ink-2)]">
            {cut.spec.code}
          </span>
          <span className="truncate font-serif text-[14px] text-[color:var(--orion-ink)]">
            {cut.spec.name}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-[color:var(--orion-ink-3)]">
            {cut.color}
          </span>
        </div>

        {/* Per-size boxes: size header + available count */}
        <div className="mt-[11px] flex flex-wrap gap-1.5">
          {cut.sizes.map((s) => (
            <div
              key={s.size}
              className="flex min-w-10 flex-col items-center overflow-hidden rounded-[7px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)]"
            >
              <span className="w-full border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-0 py-[2px] text-center font-mono text-[10.5px] font-semibold text-[color:var(--orion-ink-3)]">
                {s.size.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 font-serif text-[15px] text-[color:var(--orion-ink)] tabular-nums">
                {s.available}
              </span>
            </div>
          ))}
        </div>

        {/* Total pieces ready */}
        <div className="mt-[11px] flex items-center">
          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--orion-ink-2)]">
            <Package size={11} />
            {t("readyCount", { count: cut.total_available })}
          </span>
        </div>
      </div>

      <button
        type="button"
        data-testid="sewing-available-create"
        onClick={(e) => {
          e.stopPropagation();
          onCreate(cut);
        }}
        className="flex w-full items-center justify-center gap-1.5 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] py-2 text-[12px] font-medium text-[color:var(--brand-prod)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--brand-prod)_8%,var(--orion-surface))]"
      >
        <Send size={13} />
        {t("newShipment")}
      </button>
    </div>
  );
}
