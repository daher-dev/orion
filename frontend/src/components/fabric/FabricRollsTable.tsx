"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight, Grid3x3, Underline } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { FabricRoll } from "@/lib/schemas/fabric";

type Props = {
  data: FabricRoll[];
  onRowClick: (roll: FabricRoll) => void;
};

/**
 * Maps the design's color-name → hex palette (COLOR_NAMES_INV in
 * /docs/design/source/pages/inventory.jsx). Falls back to ink-3 grey when the
 * roll's color string isn't in the registry so we always render a swatch.
 */
const COLOR_HEX_BY_NAME: Record<string, string> = {
  preto: "#1f1f1f",
  marrom: "#7a4b2a",
  areia: "#c9b9a3",
  "off-white": "#efe6d3",
  "off white": "#f4f1ea",
  bege: "#cfb98e",
  "verde-musgo": "#7a8a76",
  verde: "#3a4a3d",
  caramelo: "#6b4a2e",
  branco: "#f4f1ea",
  vermelho: "#b03a2e",
  cru: "#efe6d3",
};

function colorHex(name: string | null | undefined): string {
  if (!name) return "var(--orion-ink-3)";
  return COLOR_HEX_BY_NAME[name.trim().toLowerCase()] ?? "var(--orion-ink-3)";
}

function usageColor(percent: number): string {
  if (percent < 25) return "var(--status-err)";
  if (percent < 50) return "var(--status-warn)";
  return "var(--brand-inv)";
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function FabricRollsTable({ data, onRowClick }: Props) {
  const t = useTranslations("fabric");
  const tColumns = useTranslations("fabric.table.columns");
  const tKinds = useTranslations("fabric.fabricRollKinds");
  const tTypes = useTranslations("fabric.fabricTypes");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<FabricRoll>[]>(
    () => [
      // .tbl col 1 — "Tipo": 28×28 surface-2 glyph + fabric type name + kind sub.
      // Design uses `grid-3x3` for corpo (body) and `underline` for ribana (rib).
      {
        id: "fabric_type",
        accessorKey: "fabric_type",
        header: tColumns("fabricType"),
        cell: (info) => (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[6px]"
              style={{
                background: "var(--orion-surface-2)",
                color: "var(--orion-ink-2)",
              }}
            >
              {info.row.original.kind === "rib" ? (
                <Underline size={15} strokeWidth={1.5} />
              ) : (
                <Grid3x3 size={15} strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-[color:var(--orion-ink)]">
                {tTypes(info.row.original.fabric_type)}
              </div>
              <div className="text-[11px] capitalize text-[color:var(--orion-ink-3)]">
                {tKinds(info.row.original.kind)}
              </div>
            </div>
          </div>
        ),
      },
      // .tbl col 2 — "Cor": 14×14 circle swatch + label.
      {
        accessorKey: "color",
        header: tColumns("color"),
        cell: (info) => {
          const name = info.getValue() as string;
          return (
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="size-3.5 flex-shrink-0 rounded-full"
                style={{
                  background: colorHex(name),
                  boxShadow:
                    "0 0 0 1px var(--orion-line), inset 0 0 0 1px rgba(255,255,255,.15)",
                }}
              />
              <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">
                {name || "—"}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "supplier_name",
        header: tColumns("supplier"),
        cell: (info) => (
          <span className="text-[13px] text-[color:var(--orion-ink-2)]">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "received_at",
        header: tColumns("receivedAt"),
        cell: (info) => {
          const date = parseDate(info.getValue() as string);
          if (!date) return null;
          return (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          );
        },
      },
      // .tbl col 5 — "Saldo": 200px wide progress bar + % indicator.
      // Direct port of inventory.jsx: progress bar height 6, --orion-bg track,
      // bar color flips err < 25%, warn < 50%, brand-inv otherwise.
      // Bar pulses (`bar-danger-pulse` / `bar-warn-pulse`) in those low ranges.
      {
        id: "usage",
        header: tColumns("usage"),
        size: 200,
        cell: (info) => {
          const row = info.row.original;
          const initial = Number(row.initial_weight_kg);
          const current = Number(row.current_weight_kg);
          const remainingPct = initial > 0 ? (current / initial) * 100 : 0;
          const clamped = Math.max(0, Math.min(100, remainingPct));
          const danger = remainingPct < 25;
          const warn = !danger && remainingPct < 50;
          const color = usageColor(remainingPct);
          return (
            <div className="flex items-center gap-2" style={{ width: "100%" }}>
              <div
                className="flex-1 overflow-hidden rounded-full"
                style={{
                  height: 6,
                  background: "var(--orion-bg)",
                }}
              >
                <div
                  data-testid="fabric-usage-bar"
                  className={
                    danger ? "bar-danger-pulse" : warn ? "bar-warn-pulse" : undefined
                  }
                  style={{
                    width: `${clamped}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 999,
                  }}
                />
              </div>
              <span
                className="font-variant-numeric tabular-nums text-[11px] text-[color:var(--orion-ink-3)]"
                style={{ minWidth: 36, textAlign: "right" }}
              >
                {remainingPct.toFixed(0)}%
              </span>
            </div>
          );
        },
      },
      // .tbl col 6 — "Restante": right-aligned, mono numerals, red when stock is critical.
      {
        accessorKey: "current_weight_kg",
        header: () => <span className="block text-right">{tColumns("currentWeight")}</span>,
        size: 100,
        cell: (info) => {
          const row = info.row.original;
          const initial = Number(row.initial_weight_kg);
          const current = Number(info.getValue() as string);
          const remainingPct = initial > 0 ? (current / initial) * 100 : 0;
          const danger = remainingPct < 25;
          return (
            <span
              className="block text-right font-variant-numeric tabular-nums"
              style={{
                color: danger ? "var(--status-err)" : "var(--orion-ink)",
                fontWeight: 500,
              }}
            >
              {current.toFixed(1)} kg
            </span>
          );
        },
      },
      {
        id: "chevron",
        header: () => <span className="sr-only">{tColumns("actions")}</span>,
        size: 36,
        cell: () => (
          <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--orion-ink-3)" }} />
        ),
      },
    ],
    [format, tColumns, tKinds, tTypes],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto" data-fabric-table-locale={t("page.eyebrow")}>
      <table
        data-testid="fabric-rolls-table"
        className="w-full border-collapse text-[13px]"
        style={{ borderSpacing: 0 }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left text-[10.5px] font-semibold uppercase"
                  style={{
                    padding: "10px 14px",
                    letterSpacing: "0.08em",
                    color: "var(--orion-ink-3)",
                    background: "var(--orion-bg)",
                    borderBottom: "1px solid var(--orion-line)",
                    width:
                      header.id === "chevron"
                        ? 36
                        : header.id === "usage"
                          ? 200
                          : header.column.columnDef.size,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, index, rows) => (
            <tr
              key={row.id}
              data-testid="fabric-row"
              onClick={() => onRowClick(row.original)}
              className="cursor-pointer transition-colors hover:bg-[color:var(--orion-bg)]"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom:
                      index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
                    color: "var(--orion-ink-2)",
                    verticalAlign: "middle",
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
