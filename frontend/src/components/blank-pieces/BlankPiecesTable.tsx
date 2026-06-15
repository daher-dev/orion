"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorDot } from "@/components/inventory/ColorDot";
import type { BlankPieceLevelRead } from "@/lib/schemas/blank-stock";

type Props = {
  data: BlankPieceLevelRead[];
  onRowClick: (row: BlankPieceLevelRead) => void;
};

type SortDir = "asc" | "desc";
type SortKey = "spec" | "color" | "size" | "min_stock" | "on_hand";
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
 * Blank pieces (peças lisas) position table — port of the prototype
 * `BlankPieces` current-position table: garment glyph + spec base, colour dot,
 * size pill, minimum, on-hand (amber + alert when at/below min).
 */
export function BlankPiecesTable({ data, onRowClick }: Props) {
  const t = useTranslations("blankPieces.table.columns");
  const [sort, setSort] = useState<SortState>({ col: "on_hand", dir: "desc" });

  const sorted = useMemo(() => {
    const rows = data.slice();
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number | null | undefined;
      let bv: string | number | null | undefined;
      switch (sort.col) {
        case "spec":
          av = a.spec.code;
          bv = b.spec.code;
          break;
        case "color":
          av = a.color;
          bv = b.color;
          break;
        case "size":
          av = a.size;
          bv = b.size;
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
      <table data-testid="blank-pieces-table" className="w-full border-collapse text-[13px]" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 44 }} />
            <th style={th}>
              <SortableHeader active={sort.col === "spec"} dir={sort.dir} onClick={() => toggle("spec")}>
                {t("base")}
              </SortableHeader>
            </th>
            <th style={th}>
              <SortableHeader active={sort.col === "color"} dir={sort.dir} onClick={() => toggle("color")}>
                {t("color")}
              </SortableHeader>
            </th>
            <th style={th}>
              <SortableHeader active={sort.col === "size"} dir={sort.dir} onClick={() => toggle("size")}>
                {t("size")}
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
            const td: React.CSSProperties = {
              padding: "12px 14px",
              borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
              color: "var(--orion-ink-2)",
              verticalAlign: "middle",
            };
            return (
              <tr
                key={row.blank_piece_id}
                data-testid="blank-pieces-row"
                onClick={() => onRowClick(row)}
                className="cursor-pointer transition-colors hover:bg-[color:var(--orion-bg)]"
              >
                <td style={td}>
                  <span className="grid size-7 place-items-center rounded-[6px] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]">
                    <Shirt size={16} strokeWidth={1.5} />
                  </span>
                </td>
                <td style={td}>
                  <span className="flex flex-col">
                    <span className="font-medium text-[color:var(--orion-ink)]">{row.spec.name}</span>
                    <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">{row.spec.code}</span>
                  </span>
                </td>
                <td style={td}>
                  <span className="inline-flex items-center gap-2">
                    <ColorDot name={row.color} />
                    <span className="text-[color:var(--orion-ink-2)]">{row.color}</span>
                  </span>
                </td>
                <td style={td}>
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-2 py-[2px] font-mono text-[11px] font-semibold tracking-[0.04em] text-[color:var(--orion-ink-2)]">
                    {row.size.toUpperCase()}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right", color: "var(--orion-ink-3)" }} className="tabular-nums">
                  {row.min_stock ?? "—"}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <span
                    data-testid={`blank-pieces-on-hand-${row.blank_piece_id}`}
                    className="inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums"
                    style={{ color: row.low_stock ? "var(--status-warn)" : "var(--orion-ink)" }}
                  >
                    {row.low_stock ? <AlertTriangle size={12} style={{ color: "var(--status-warn)" }} /> : null}
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
