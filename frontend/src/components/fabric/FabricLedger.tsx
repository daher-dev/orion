"use client";

import { ArrowDownCircle, ArrowUpCircle, Layers, Scissors } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { FabricMovementRead } from "@/lib/schemas/fabric";

/**
 * Metered movement ledger for fabric rolls (bobinas) — sibling of the paper
 * `PaperLedger`. Quantities are Decimal strings rendered in kg. Entries and
 * adjustments are credits (+, green); exits are debits (−, red). EXIT rows
 * written by a cutting order's DONE transition surface their provenance
 * ("Corte CO-XXXX") read-only.
 */
type Props = {
  rows: FabricMovementRead[];
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cuttingCode(id: string): string {
  return `CO-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function FabricLedger({ rows }: Props) {
  const t = useTranslations("fabric.movements");
  const tTypes = useTranslations("fabric.fabricTypes");
  const format = useFormatter();

  if (rows.length === 0) {
    return (
      <div
        data-testid="fabric-ledger-empty"
        className="px-6 py-12 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
      >
        {t("empty")}
      </div>
    );
  }

  const th: React.CSSProperties = {
    padding: "10px 14px",
    letterSpacing: "0.08em",
    color: "var(--orion-ink-3)",
    background: "var(--orion-bg)",
    borderBottom: "1px solid var(--orion-line)",
  };

  return (
    <div className="overflow-x-auto">
      <table data-testid="fabric-ledger" className="w-full border-collapse text-[13px]" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="text-left text-[10.5px] font-semibold uppercase" style={th}>
              {t("columns.when")}
            </th>
            <th className="text-left text-[10.5px] font-semibold uppercase" style={th}>
              {t("columns.item")}
            </th>
            <th className="text-left text-[10.5px] font-semibold uppercase" style={th}>
              {t("columns.reason")}
            </th>
            <th className="text-right text-[10.5px] font-semibold uppercase" style={{ ...th, width: 110 }}>
              {t("columns.quantity")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index, all) => {
            const isCredit = row.kind === "entry" || row.kind === "adjustment";
            const tone = isCredit ? "var(--status-ok)" : "var(--status-err)";
            const date = parseDate(row.created_at);
            const td: React.CSSProperties = {
              padding: "12px 14px",
              borderBottom: index === all.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
              verticalAlign: "middle",
            };
            return (
              <tr key={row.id} data-testid="fabric-ledger-row" className="transition-colors hover:bg-[color:var(--orion-bg)]">
                <td style={td}>
                  <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                    {date ? format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                  </span>
                </td>
                <td style={td}>
                  {row.fabric_roll ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="grid size-6 place-items-center rounded-[6px] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]">
                        <Layers size={13} />
                      </span>
                      <span className="text-[color:var(--orion-ink)]">{tTypes(row.fabric_roll.fabric_type)}</span>
                      <span className="text-[12px] text-[color:var(--orion-ink-3)]">{row.fabric_roll.color}</span>
                    </span>
                  ) : (
                    <span className="text-[color:var(--orion-ink-3)]">—</span>
                  )}
                </td>
                <td style={td}>
                  <span className="inline-flex items-center gap-1.5">
                    {isCredit ? (
                      <ArrowDownCircle size={13} style={{ color: tone }} />
                    ) : (
                      <ArrowUpCircle size={13} style={{ color: tone }} />
                    )}
                    <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">{t(`kinds.${row.kind}`)}</span>
                    {row.cutting_order_id ? (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-[5px] bg-[color:var(--orion-surface-2)] px-1.5 py-[1px] font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">
                        <Scissors size={10} />
                        {t("provenance", { code: cuttingCode(row.cutting_order_id) })}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <span
                    data-testid={`fabric-ledger-qty-${row.id}`}
                    className="font-medium tabular-nums"
                    style={{ color: tone }}
                  >
                    {isCredit ? "+" : "−"}
                    {format.number(Number(row.quantity), { maximumFractionDigits: 3 })} kg
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
