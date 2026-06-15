"use client";

import { Check, Stamp, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BatchEstampaRow } from "@/lib/schemas/batch";

/**
 * The lote's per-estampa production grid (port of `lotes.jsx` `LoteDetail`
 * estampa list — Montador DTF code dropped). One row per print design with
 * its thumbnail, `items`, `to_print`, `montado` (assembled coverage) and
 * `enviado` (shipped) figures, all computed live by the backend.
 */
type Props = {
  rows: BatchEstampaRow[];
};

export function LoteEstampaGrid({ rows }: Props) {
  const t = useTranslations("batches.estampas");

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] px-4 py-10 text-center text-[13px] text-[color:var(--orion-ink-3)]">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5" data-testid="lote-estampa-grid">
      {rows.map((row, i) => (
        <EstampaRow key={row.design?.id ?? `none-${i}`} row={row} />
      ))}
    </div>
  );
}

function EstampaRow({ row }: { row: BatchEstampaRow }) {
  const t = useTranslations("batches.estampas");
  const thumbUrl = row.design?.image_url ?? null;

  return (
    <div
      data-testid={`lote-estampa-row-${row.design?.id ?? "none"}`}
      className="flex flex-wrap items-center gap-3.5 rounded-[14px] border p-[12px_16px]"
      style={{
        background: "color-mix(in oklab, var(--brand-sales) 6%, var(--orion-surface))",
        borderColor: "color-mix(in oklab, var(--brand-sales) 14%, var(--orion-surface))",
      }}
    >
      {/* thumb */}
      <span
        className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-[8px] text-white"
        style={{
          background: thumbUrl
            ? `center / cover no-repeat url(${thumbUrl})`
            : "radial-gradient(circle at 30% 28%, color-mix(in oklab, var(--brand-sales) 50%, white), var(--brand-sales))",
        }}
      >
        {thumbUrl ? null : <Stamp size={20} strokeWidth={1.6} />}
      </span>

      {/* code + name */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-[18px] text-[color:var(--orion-ink)]">
            {row.code}
          </span>
          {row.design?.name ? (
            <span className="truncate text-[12.5px] text-[color:var(--orion-ink-3)]">
              {row.design.name}
            </span>
          ) : (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {t("noEstampa")}
            </span>
          )}
        </div>
      </div>

      {/* items */}
      <Metric value={row.items} label={t("items")} />

      {/* to print */}
      <Metric
        value={row.to_print}
        label={t("toPrint")}
        accent={row.to_print > 0}
      />

      {/* montado — count + assembled check */}
      <div className="min-w-[60px] text-center" data-testid="lote-montado">
        <div
          className="inline-flex items-center gap-1 font-serif text-[20px]"
          style={{
            color: row.is_assembled
              ? "var(--status-ok)"
              : "var(--orion-ink)",
          }}
        >
          {row.is_assembled ? <Check size={16} strokeWidth={2.4} /> : null}
          {row.montado}
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
          {t("montado")}
        </div>
      </div>

      {/* enviado — count + shipped truck */}
      <div className="min-w-[60px] text-center" data-testid="lote-enviado">
        <div
          className="inline-flex items-center gap-1 font-serif text-[20px]"
          style={{
            color: row.is_shipped ? "var(--status-ok)" : "var(--orion-ink-3)",
          }}
        >
          {row.is_shipped ? <Truck size={15} strokeWidth={2} /> : null}
          {row.enviado}
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
          {t("enviado")}
        </div>
      </div>
    </div>
  );
}

function Metric({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[56px] text-center">
      <div
        className="font-serif text-[20px]"
        style={{ color: accent ? "var(--brand-sales)" : "var(--orion-ink)" }}
      >
        {value}
      </div>
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
        {label}
      </div>
    </div>
  );
}
