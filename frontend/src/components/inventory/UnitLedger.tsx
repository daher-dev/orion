"use client";

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

/**
 * Generalised movement ledger — Data / Item / Motivo / Qtd columns with a
 * signed coloured quantity and a kind→i18n label. Generalises
 * `components/stock/MovementsTable.tsx` for the counted WIP tiers (blank,
 * printed). A movement kind is one of `entry`/`exit`/`adjustment`; entries and
 * adjustments are credits (+, green), exits are debits (−, red).
 *
 * The tier passes a `labelFor(row)` to render the per-row item cell (e.g. spec ·
 * color · size, or design + side) and the `i18nNamespace` whose `ledger.*`
 * leaves provide column headers, the kind labels and the empty state.
 */
export type LedgerRow = {
  id: string;
  kind: "entry" | "exit" | "adjustment";
  quantity: number;
  notes?: string | null;
  created_at: string;
};

type Props<T extends LedgerRow> = {
  rows: T[];
  /** i18n namespace exposing `ledger.columns.*`, `ledger.kinds.*`, `ledger.empty`. */
  i18nNamespace: string;
  /** Renders the per-row "Item" cell. */
  labelFor: (row: T) => React.ReactNode;
  /** data-testid for the table element. */
  testId?: string;
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function UnitLedger<T extends LedgerRow>({ rows, i18nNamespace, labelFor, testId }: Props<T>) {
  const t = useTranslations(i18nNamespace);
  const format = useFormatter();

  if (rows.length === 0) {
    return (
      <div
        data-testid={testId ? `${testId}-empty` : "unit-ledger-empty"}
        className="px-6 py-12 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
      >
        {t("ledger.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        data-testid={testId ?? "unit-ledger"}
        className="w-full border-collapse text-[13px]"
        style={{ borderSpacing: 0 }}
      >
        <thead>
          <tr>
            {(["when", "item", "reason"] as const).map((col) => (
              <th
                key={col}
                className="text-left text-[10.5px] font-semibold uppercase"
                style={{
                  padding: "10px 14px",
                  letterSpacing: "0.08em",
                  color: "var(--orion-ink-3)",
                  background: "var(--orion-bg)",
                  borderBottom: "1px solid var(--orion-line)",
                }}
              >
                {t(`ledger.columns.${col}`)}
              </th>
            ))}
            <th
              className="text-right text-[10.5px] font-semibold uppercase"
              style={{
                padding: "10px 14px",
                letterSpacing: "0.08em",
                color: "var(--orion-ink-3)",
                background: "var(--orion-bg)",
                borderBottom: "1px solid var(--orion-line)",
                width: 90,
              }}
            >
              {t("ledger.columns.quantity")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isCredit = row.kind === "entry" || row.kind === "adjustment";
            const tone = isCredit ? "var(--status-ok)" : "var(--status-err)";
            const date = parseDate(row.created_at);
            return (
              <tr
                key={row.id}
                data-testid="unit-ledger-row"
                className="transition-colors hover:bg-[color:var(--orion-bg)]"
              >
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
                    verticalAlign: "middle",
                  }}
                >
                  <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                    {date
                      ? format.dateTime(date, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
                    color: "var(--orion-ink-2)",
                    verticalAlign: "middle",
                  }}
                >
                  {labelFor(row)}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
                    verticalAlign: "middle",
                  }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isCredit ? (
                      <ArrowDownCircle size={13} style={{ color: tone }} />
                    ) : (
                      <ArrowUpCircle size={13} style={{ color: tone }} />
                    )}
                    <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">
                      {t(`ledger.kinds.${row.kind}`)}
                    </span>
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
                    verticalAlign: "middle",
                  }}
                >
                  <span
                    data-testid={`unit-ledger-qty-${row.id}`}
                    className="block text-right font-medium tabular-nums"
                    style={{ color: tone }}
                  >
                    {isCredit ? "+" : "−"}
                    {row.quantity}
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
