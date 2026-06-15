"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { NumberInput } from "@/components/ui/number-input";
import { InkDot } from "@/components/inventory/InkDot";
import { PngFlag } from "@/components/inventory/PngFlag";
import { SideGlyph } from "@/components/inventory/SideGlyph";
import type { Print, PrintSide, PrintVariation } from "@/lib/schemas/print";
import { cellOf, gradeKey, type Grade } from "./grade";

/**
 * Per-side grid of variation rows — port of `SideGrid` from `printing.jsx`.
 * Each row: ink dot + variation name + PNG flag, a `planned` NumberInput, and
 * (edit mode only) a `printed` NumberInput with a "mark printed = planned" quick
 * button gated on the side's artwork being uploaded (`*_status === "ok"`), plus
 * an inline progress bar. The subtotal row sums the side.
 */

type Props = {
  design: Print;
  side: PrintSide;
  grade: Grade;
  /** New mode hides the printed column (only planning a fresh order). */
  isNew: boolean;
  onCell: (variationId: string, sideKey: PrintSide, key: "planned" | "printed", value: number) => void;
  testId?: string;
};

function artworkOk(variation: PrintVariation, side: PrintSide): boolean {
  return side === "back" ? variation.back_status === "ok" : variation.front_status === "ok";
}

export function SideGrid({ design, side, grade, isNew, onCell, testId }: Props) {
  const t = useTranslations("printOrders.detail");
  const variations = design.variations;

  const subPlanned = variations.reduce((s, v) => s + cellOf(grade, v.id, side).planned, 0);
  const subPrinted = variations.reduce((s, v) => s + cellOf(grade, v.id, side).printed, 0);

  return (
    <div className="mt-3.5" data-testid={testId}>
      {/* Side header */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid size-[22px] place-items-center rounded-[6px]"
          style={{
            background: "color-mix(in oklab, var(--brand-prod) 12%, var(--orion-surface))",
            color: "var(--brand-prod)",
          }}
        >
          <SideGlyph side={side} size={12} color="var(--brand-prod)" />
        </span>
        <span className="text-[12.5px] font-semibold text-[color:var(--orion-ink)]">
          {t(side === "back" ? "back" : "front")}
        </span>
        <span className="ml-auto text-[11.5px] text-[color:var(--orion-ink-2)] tabular-nums">
          {isNew ? `${subPlanned} ${t("plannedShort")}` : `${subPrinted} / ${subPlanned}`}
        </span>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
        {/* Column header */}
        <div
          className="grid items-center gap-3 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]"
          style={{ gridTemplateColumns: isNew ? "1fr 110px" : "1fr 96px 1.2fr" }}
        >
          <span>{t("variation")}</span>
          <span className="text-right">{t("planned")}</span>
          {!isNew ? <span className="text-right">{t("printed")}</span> : null}
        </div>

        {variations.map((v, i) => {
          const cell = cellOf(grade, v.id, side);
          const pngOk = artworkOk(v, side);
          const pct = cell.planned > 0 ? Math.min(100, (cell.printed / cell.planned) * 100) : 0;
          const reached = cell.planned > 0 && cell.printed >= cell.planned;
          return (
            <div
              key={gradeKey(v.id, side)}
              className="grid items-center gap-3 px-3.5 py-2.5"
              style={{
                gridTemplateColumns: isNew ? "1fr 110px" : "1fr 96px 1.2fr",
                borderBottom: i < variations.length - 1 ? "1px solid var(--orion-line-soft)" : "none",
              }}
            >
              {/* Variation */}
              <div className="flex min-w-0 items-center gap-2">
                <InkDot ink={v.ink_hex} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] text-[color:var(--orion-ink)]">{v.name}</div>
                  <PngFlag ok={pngOk} />
                </div>
              </div>

              {/* Planned */}
              <div className="flex justify-end">
                <NumberInput
                  tone="prod"
                  step={1}
                  min={0}
                  decimals={0}
                  align="center"
                  aria-label={`${v.name} ${t("planned")}`}
                  value={cell.planned}
                  onChange={(next) => onCell(v.id, side, "planned", next === "" ? 0 : Math.max(0, Number(next) || 0))}
                />
              </div>

              {/* Printed (edit mode) */}
              {!isNew ? (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    aria-label={t("markPrinted")}
                    title={pngOk ? t("markPrinted") : t("pngMissingHint")}
                    disabled={cell.planned === 0 || cell.printed === cell.planned || !pngOk}
                    onClick={() => onCell(v.id, side, "printed", cell.planned)}
                    className="grid size-[22px] flex-shrink-0 place-items-center rounded-[6px] border transition-colors disabled:cursor-default"
                    style={{
                      borderColor: "var(--orion-line)",
                      background: reached ? "var(--brand-prod)" : "var(--orion-surface)",
                      color: reached ? "#fff" : "var(--orion-ink-3)",
                      opacity: cell.planned === 0 || !pngOk ? 0.4 : 1,
                    }}
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </button>
                  <div
                    className="hidden flex-1 overflow-hidden rounded-full sm:block"
                    style={{ maxWidth: 56, height: 4, background: "var(--orion-line-soft)" }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "var(--brand-prod)",
                      }}
                    />
                  </div>
                  <div className="w-[76px]">
                    <NumberInput
                      tone="prod"
                      step={1}
                      min={0}
                      decimals={0}
                      align="center"
                      aria-label={`${v.name} ${t("printed")}`}
                      value={cell.printed}
                      onChange={(next) =>
                        onCell(v.id, side, "printed", next === "" ? 0 : Math.max(0, Number(next) || 0))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Subtotal */}
        <div
          className="grid items-center gap-3 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3.5 py-2.5 font-serif text-[13px] text-[color:var(--orion-ink)]"
          style={{ gridTemplateColumns: isNew ? "1fr 110px" : "1fr 96px 1.2fr" }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
            {t("subtotal")}
          </span>
          <span className="text-right tabular-nums">{subPlanned}</span>
          {!isNew ? <span className="text-right tabular-nums">{subPrinted}</span> : null}
        </div>
      </div>
    </div>
  );
}
