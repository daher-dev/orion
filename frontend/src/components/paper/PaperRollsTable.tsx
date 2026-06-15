"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp, Scroll } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { PaperRoll } from "@/lib/schemas/paper-roll";

type Props = {
  data: PaperRoll[];
  onRowClick: (row: PaperRoll) => void;
};

type SortDir = "asc" | "desc";
type SortKey = "paper_type" | "width_cm" | "supplier_name" | "received_at" | "current_meters";
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

/** Saldo bar — width = current/initial; red < 25%, amber < 50%, else brand. */
function SaldoBar({ pct }: { pct: number }) {
  const danger = pct < 25;
  const warn = !danger && pct < 50;
  const color = danger ? "var(--status-err)" : warn ? "var(--status-warn)" : "var(--brand-inv)";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: "var(--orion-bg)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
        />
      </div>
      <span className="min-w-9 text-[11px] text-[color:var(--orion-ink-3)] tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

/**
 * Paper rolls (bobinas de papel/filme) table — port of the prototype
 * `PaperRolls` current-position table: roll glyph + paper type, width, supplier,
 * received date, saldo % bar, remaining meters (red when low).
 */
export function PaperRollsTable({ data, onRowClick }: Props) {
  const t = useTranslations("paperRolls.table.columns");
  const tTypes = useTranslations("paperRolls.types");
  const format = useFormatter();
  const [sort, setSort] = useState<SortState>({ col: "current_meters", dir: "desc" });

  const sorted = useMemo(() => {
    const rows = data.slice();
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sort.col) {
        case "paper_type":
          av = a.paper_type;
          bv = b.paper_type;
          break;
        case "width_cm":
          av = a.width_cm;
          bv = b.width_cm;
          break;
        case "supplier_name":
          av = a.supplier_name;
          bv = b.supplier_name;
          break;
        case "received_at":
          av = a.received_at;
          bv = b.received_at;
          break;
        case "current_meters":
          av = Number(a.current_meters);
          bv = Number(b.current_meters);
          break;
      }
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "pt-BR") * dir;
      return ((av as number) - (bv as number)) * dir;
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
      <table data-testid="paper-rolls-table" className="w-full border-collapse text-[13px]" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={th}>
              <SortableHeader active={sort.col === "paper_type"} dir={sort.dir} onClick={() => toggle("paper_type")}>
                {t("type")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 90 }}>
              <SortableHeader active={sort.col === "width_cm"} dir={sort.dir} num onClick={() => toggle("width_cm")}>
                {t("width")}
              </SortableHeader>
            </th>
            <th style={th}>
              <SortableHeader active={sort.col === "supplier_name"} dir={sort.dir} onClick={() => toggle("supplier_name")}>
                {t("supplier")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 110 }}>
              <SortableHeader active={sort.col === "received_at"} dir={sort.dir} onClick={() => toggle("received_at")}>
                {t("received")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 200 }}>{t("saldo")}</th>
            <th style={{ ...th, width: 110 }}>
              <SortableHeader active={sort.col === "current_meters"} dir={sort.dir} num onClick={() => toggle("current_meters")}>
                {t("remaining")}
              </SortableHeader>
            </th>
            <th style={{ ...th, width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index, rows) => {
            const initial = Number(row.initial_meters) || 0;
            const current = Number(row.current_meters) || 0;
            const pct = initial > 0 ? (current / initial) * 100 : 0;
            const td: React.CSSProperties = {
              padding: "12px 14px",
              borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
              color: "var(--orion-ink-2)",
              verticalAlign: "middle",
            };
            return (
              <tr
                key={row.id}
                data-testid="paper-rolls-row"
                onClick={() => onRowClick(row)}
                className="cursor-pointer transition-colors hover:bg-[color:var(--orion-bg)]"
              >
                <td style={td}>
                  <span className="inline-flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-[6px] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]">
                      <Scroll size={15} strokeWidth={1.5} />
                    </span>
                    <span className="font-medium text-[color:var(--orion-ink)] whitespace-nowrap">
                      {tTypes(row.paper_type)}
                    </span>
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right" }} className="tabular-nums">
                  {row.width_cm} cm
                </td>
                <td style={td}>{row.supplier_name}</td>
                <td style={{ ...td, fontSize: 12, color: "var(--orion-ink-3)" }}>
                  {format.dateTime(new Date(row.received_at), { day: "2-digit", month: "2-digit", year: "numeric" })}
                </td>
                <td style={td}>
                  <SaldoBar pct={pct} />
                </td>
                <td
                  style={{ ...td, textAlign: "right" }}
                  className="font-medium tabular-nums"
                >
                  <span
                    data-testid={`paper-rolls-remaining-${row.id}`}
                    style={{ color: pct < 25 ? "var(--status-err)" : "var(--orion-ink)" }}
                  >
                    {format.number(current, { maximumFractionDigits: 0 })} m
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
