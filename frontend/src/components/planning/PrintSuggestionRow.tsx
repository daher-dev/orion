"use client";

import { Image as ImageIcon, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { TransferChip } from "@/components/inventory/TransferChip";
import type { PlanningImpressao } from "@/lib/schemas/planning";
import { SourceBadge } from "./SourceBadge";

/**
 * One impressão (print) suggestion row — port of the Impressões `<label>` from
 * the prototype `planejamento.jsx`. A checkbox toggles the row's key (the print
 * design id); the design thumb + `{code} {name}` head it; the big "a imprimir"
 * number is the total (demand + stock); the footer shows source badges with the
 * order count on the demand badge plus a PNG-ready flag (green when the FRONT
 * variation has artwork, amber otherwise).
 */
type Props = {
  impressao: PlanningImpressao;
  checked: boolean;
  disabled?: boolean;
  onToggle: (key: string) => void;
};

export function PrintSuggestionRow({ impressao, checked, disabled, onToggle }: Props) {
  const t = useTranslations("planning");
  const pngOk = impressao.png === "ok";
  return (
    <label
      data-testid={`planning-print-row-${impressao.key}`}
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
          onChange={() => onToggle(impressao.key)}
          className="size-4 flex-shrink-0"
          style={{ accentColor: "var(--brand-prod)" }}
        />
        <TransferChip imageUrl={impressao.design.image_url} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] font-semibold text-[color:var(--orion-ink)]">
              {impressao.design.code}
            </span>
            <span className="truncate text-[13px] text-[color:var(--orion-ink-2)]">{impressao.design.name}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-serif text-[22px] leading-none tabular-nums" style={{ color: "var(--brand-prod)" }}>
            {impressao.total}
          </div>
          <div className="mt-0.5 text-[9.5px] uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
            {t("row.toPrint")}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[color:var(--orion-line-soft)] pt-[9px]">
        {impressao.sources.map((s) => (
          <SourceBadge
            key={s}
            kind={s}
            detail={s === "demanda" ? t("row.orders", { count: impressao.order_count }) : null}
          />
        ))}
        <span
          className="inline-flex items-center gap-[3px] text-[9.5px] font-semibold tracking-[0.02em]"
          style={{ color: pngOk ? "var(--status-ok)" : "var(--status-warn)" }}
        >
          {pngOk ? <ImageIcon size={10} /> : <ImageOff size={10} />}
          {pngOk ? t("png.ok") : t("png.pending")}
        </span>
      </div>
    </label>
  );
}
