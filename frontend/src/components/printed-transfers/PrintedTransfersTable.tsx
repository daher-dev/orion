"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { SideGlyph } from "@/components/inventory/SideGlyph";
import { TransferChip } from "@/components/inventory/TransferChip";
import type { PrintedTransferLevelRead } from "@/lib/schemas/printed-transfer";

type Props = {
  data: PrintedTransferLevelRead[];
  onRowClick: (row: PrintedTransferLevelRead) => void;
};

type SortDir = "asc" | "desc";
type SortKey = "design" | "side" | "min_stock" | "on_hand";
type SortState = { col: SortKey; dir: SortDir };

function SortableHeader({
  active,
  dir,
  num,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir;
  num?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  let Icon: typeof ChevronsUpDown = ChevronsUpDown;
  if (active) Icon = dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: active ? "var(--orion-ink)" : "var(--orion-ink-3)",
        userSelect: "none",
        justifyContent: num ? "flex-end" : "flex-start",
      }}
    >
      {children}
      <Icon size={11} style={{ color: active ? "var(--brand-inv)" : "var(--orion-ink-3)", opacity: active ? 1 : 0.5 }} />
    </button>
  );
}

/**
 * Printed transfers (estampados) position table — port of the prototype
 * `Printed` table, adapted to the real contract: TransferChip thumbnail,
 * design code/name, side glyph (frente/costas), minimum, on-hand (red when 0,
 * amber + alert when low).
 */
export function PrintedTransfersTable({ data, onRowClick }: Props) {
  const t = useTranslations("printedTransfers.table.columns");
  const tSides = useTranslations("printedTransfers.sides");
  const [sort, setSort] = useState<SortState>({ col: "on_hand", dir: "desc" });

  const sorted = useMemo(() => {
    const rows = data.slice();
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number | null | undefined;
      let bv: string | number | null | undefined;
      switch (sort.col) {
        case "design":
          av = a.design.code;
          bv = b.design.code;
          break;
        case "side":
          av = a.side;
          bv = b.side;
          break;
        case "min_stock":
          av = a.min_stock ?? 0;
          bv = b.min_stock ?? 0;
          break;
        case "on_hand":
          av = a.on_hand;
          bv = b.on_hand;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "pt-BR") * dir;
      return (((av as number) ?? 0) - ((bv as number) ?? 0)) * dir;
    });
    return rows;
  }, [data, sort]);

  function toggle(col: SortKey) {
    setSort((prev) => (prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  }

  const th: React.CSSProperties = {
    padding: "10px 14px",
    background: "var(--orion-bg)",
    borderBottom: "1px solid var(--orion-line)",
    textAlign: "left",
  };

  return (
    <div className="overflow-x-auto">
      <table data-testid="printed-transfers-table" className="w-full border-collapse text-[13px]" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 44 }} />
            <th style={th}>
              <SortableHeader active={sort.col === "design"} dir={sort.dir} onClick={() => toggle("design")}>
                {t("design")}
              </SortableHeader>
            </th>
            <th style={th}>
              <SortableHeader active={sort.col === "side"} dir={sort.dir} onClick={() => toggle("side")}>
                {t("side")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 100 }}>
              <SortableHeader active={sort.col === "min_stock"} dir={sort.dir} num onClick={() => toggle("min_stock")}>
                {t("min")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 110 }}>
              <SortableHeader active={sort.col === "on_hand"} dir={sort.dir} num onClick={() => toggle("on_hand")}>
                {t("onHand")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index, rows) => {
            const out = row.on_hand <= 0;
            const td: React.CSSProperties = {
              padding: "12px 14px",
              borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
              color: "var(--orion-ink-2)",
              verticalAlign: "middle",
            };
            return (
              <tr
                key={row.printed_transfer_id}
                data-testid="printed-transfers-row"
                onClick={() => onRowClick(row)}
                className="cursor-pointer transition-colors hover:bg-[color:var(--orion-bg)]"
              >
                <td style={td}>
                  <TransferChip imageUrl={row.design.image_url} size={28} />
                </td>
                <td style={td}>
                  <span className="flex flex-col">
                    <span className="font-medium text-[color:var(--orion-ink)]">{row.design.name}</span>
                    <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">{row.design.code}</span>
                  </span>
                </td>
                <td style={td}>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--orion-ink-2)]">
                    <SideGlyph side={row.side} size={15} />
                    {tSides(row.side)}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right", color: "var(--orion-ink-3)" }} className="tabular-nums">
                  {row.min_stock ?? "—"}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <span
                    data-testid={`printed-transfers-on-hand-${row.printed_transfer_id}`}
                    className="inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums"
                    style={{ color: out ? "var(--status-err)" : row.low_stock ? "var(--status-warn)" : "var(--orion-ink)" }}
                  >
                    {out || row.low_stock ? (
                      <AlertTriangle size={12} style={{ color: out ? "var(--status-err)" : "var(--status-warn)" }} />
                    ) : null}
                    {row.on_hand}
                  </span>
                </td>
                <td style={td}>
                  <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--orion-ink-3)" }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
