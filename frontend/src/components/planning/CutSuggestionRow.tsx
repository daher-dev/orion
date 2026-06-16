"use client";

import { useTranslations } from "next-intl";
import { GarmentGlyph, garmentGlyphType } from "@/components/ui/garment-glyph";
import type { PlanningCorte } from "@/lib/schemas/planning";
import { SourceBadge } from "./SourceBadge";

/**
 * One corte (cutting) suggestion row — port of the Cortes `<label>` from the
 * prototype `planejamento.jsx`. A checkbox toggles the row's key into the
 * selection; the garment glyph + `{spec.name} · {color}` head it; per-size grade
 * chips (`{size}·{qty}`) summarise the grade; the big "a cortar" number is the
 * total (demand + stock); the footer shows source badges with the order count on
 * the demand badge. Read-only users get a disabled checkbox.
 */
type Props = {
  corte: PlanningCorte;
  checked: boolean;
  disabled?: boolean;
  onToggle: (key: string) => void;
};

export function CutSuggestionRow({ corte, checked, disabled, onToggle }: Props) {
  const t = useTranslations("planning");
  return (
    <label
      data-testid={`planning-cut-row-${corte.key}`}
      className="flex cursor-pointer flex-col gap-[9px] border-t border-[color:var(--orion-line-soft)] px-4 py-3 first:border-t-0 has-[:disabled]:cursor-default"
      style={{
        background: checked ? "color-mix(in oklab, var(--brand-prod) 5%, var(--orion-surface))" : "transparent",
      }}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => onToggle(corte.key)}
          className="size-4 flex-shrink-0 accent-[color:var(--brand-prod)]"
          style={{ accentColor: "var(--brand-prod)" }}
        />
        <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]">
          <GarmentGlyph productType={garmentGlyphType(corte.product_type)} size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-[color:var(--orion-ink)]">
            {corte.spec.name} <span className="font-normal text-[color:var(--orion-ink-3)]">· {corte.color}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {corte.grade_rows.map((g) => (
              <span
                key={g.size}
                className="inline-flex items-baseline gap-[3px] rounded-[5px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-[7px] py-[2px] text-[11px] text-[color:var(--orion-ink-2)]"
              >
                <b className="font-mono font-semibold">{g.size.toUpperCase()}</b>
                <span className="text-[color:var(--orion-ink-3)]">·</span>
                <span className="tabular-nums">{g.qty}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-serif text-[22px] leading-none tabular-nums" style={{ color: "var(--brand-prod)" }}>
            {corte.total}
          </div>
          <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
            {t("row.toCut")}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--orion-line-soft)] pt-[9px]">
        {corte.sources.map((s) => (
          <SourceBadge
            key={s}
            kind={s}
            detail={
              s === "demanda"
                ? t("row.orders", { count: corte.order_count })
                : null
            }
          />
        ))}
      </div>
    </label>
  );
}
