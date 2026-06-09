"use client";

import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { SupplyMovementKind, SupplyMovementRead } from "@/lib/schemas/supply";

type Props = {
  data: SupplyMovementRead[];
};

const KIND_META: Record<SupplyMovementKind, { credit: boolean; icon: typeof ArrowUpRight }> = {
  entry: { credit: true, icon: ArrowUpRight },
  adjustment: { credit: true, icon: SlidersHorizontal },
  exit: { credit: false, icon: ArrowDownLeft },
};

function trimDecimals(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : value;
}

export function SupplyMovementsTable({ data }: Props) {
  const tColumns = useTranslations("supplies.movements.columns");
  const tKinds = useTranslations("supplies.kinds");
  const format = useFormatter();

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="supply-movements-table"
        className="w-full border-collapse text-[13px]"
        style={{ borderSpacing: 0 }}
      >
        <thead>
          <tr>
            {[
              { id: "when", label: tColumns("when") },
              { id: "supply", label: tColumns("supply") },
              { id: "kind", label: tColumns("kind") },
              { id: "quantity", label: tColumns("quantity"), right: true },
              { id: "notes", label: tColumns("notes") },
            ].map((col) => (
              <th
                key={col.id}
                className="text-[10.5px] font-semibold uppercase"
                style={{
                  padding: "10px 14px",
                  textAlign: col.right ? "right" : "left",
                  letterSpacing: "0.08em",
                  color: "var(--orion-ink-3)",
                  background: "var(--orion-bg)",
                  borderBottom: "1px solid var(--orion-line)",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((m, index) => {
            const meta = KIND_META[m.kind];
            const Icon = meta.icon;
            const date = new Date(m.created_at);
            const last = index === data.length - 1;
            const border = last ? "0" : "1px solid var(--orion-line-soft)";
            return (
              <tr key={m.id} data-testid="supply-movement-row">
                <td style={{ padding: "12px 14px", borderBottom: border }}>
                  <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                    {Number.isNaN(date.getTime())
                      ? "—"
                      : format.dateTime(date, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: border }}>
                  <span className="text-[13px] text-[color:var(--orion-ink)]">
                    {m.supply?.name ?? "—"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: border }}>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11.5px] font-medium"
                    style={{
                      background: meta.credit
                        ? "color-mix(in oklab, var(--brand-inv) 12%, var(--orion-surface))"
                        : "color-mix(in oklab, var(--status-err) 12%, var(--orion-surface))",
                      color: meta.credit ? "var(--brand-inv)" : "var(--status-err)",
                    }}
                  >
                    <Icon size={12} strokeWidth={2} />
                    {tKinds(m.kind)}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: border, textAlign: "right" }}>
                  <span
                    className="font-variant-numeric tabular-nums"
                    style={{ color: meta.credit ? "var(--orion-ink)" : "var(--status-err)", fontWeight: 500 }}
                  >
                    {meta.credit ? "+" : "−"}
                    {trimDecimals(m.quantity)} {m.supply?.unit ?? ""}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: border }}>
                  <span className="text-[12px] text-[color:var(--orion-ink-3)]">{m.notes || "—"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
