"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { VariationStockRead } from "@/lib/schemas/stock";
import { StockStatusPill } from "@/components/stock/StockStatusPill";

type Props = {
  data: VariationStockRead[];
  threshold: number;
  onRowClick: (row: VariationStockRead) => void;
};

/** Best-effort color-code → hex map. Matches the design's swatch palette. */
function guessHex(code: string): string {
  const map: Record<string, string> = {
    PRT: "#1f1f1f",
    BLK: "#1f1f1f",
    OFF: "#f4f1ea",
    BRA: "#f4f1ea",
    WHT: "#f4f1ea",
    MAR: "#7a4b2a",
    ARE: "#c9b9a3",
    BEG: "#cfb98e",
    MUS: "#7a8a76",
    VRD: "#3a4a3d",
    GRN: "#3a4a3d",
    CAR: "#6b4a2e",
    VRM: "#b03a2e",
    RED: "#b03a2e",
    AZM: "#2a3b5a",
    BLU: "#2a3b5a",
    CRU: "#efe6d3",
  };
  return map[code.toUpperCase()] ?? "var(--orion-surface-2)";
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Variation × on-hand table. Mirrors the inventory.jsx Stock section: SKU mono
 * column, product name + size pill + color swatch, on-hand quantity right-aligned
 * (red if 0, amber if low), status pill, last-movement date.
 */
export function StockLevelsTable({ data, threshold, onRowClick }: Props) {
  const t = useTranslations("stock.table.columns");
  const tSizes = useTranslations("products.variations.sizes");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<VariationStockRead>[]>(
    () => [
      {
        accessorKey: "sku",
        header: t("sku"),
        size: 160,
        cell: (info) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "product",
        header: t("product"),
        cell: (info) => (
          <span className="font-medium text-[color:var(--orion-ink)]">
            {info.row.original.product.name}
          </span>
        ),
      },
      {
        id: "size",
        header: t("size"),
        size: 80,
        cell: (info) => (
          <span
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[11.5px] font-semibold tracking-[0.04em]"
            style={{ fontFamily: "var(--font-mono)", minWidth: 28 }}
          >
            {tSizes(info.row.original.size as never)}
          </span>
        ),
      },
      {
        id: "color",
        header: t("color"),
        cell: (info) => (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 flex-shrink-0 rounded-full"
              style={{
                background: guessHex(info.row.original.color_code),
                boxShadow:
                  "0 0 0 1px var(--orion-line), inset 0 0 0 1px rgba(255,255,255,.15)",
              }}
            />
            <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">
              {info.row.original.color}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "on_hand",
        header: () => <span className="block text-right">{t("onHand")}</span>,
        size: 100,
        cell: (info) => {
          const value = info.getValue() as number;
          const isCritical = value <= 0;
          const color = isCritical
            ? "var(--status-err)"
            : value <= threshold
              ? "var(--status-warn)"
              : "var(--orion-ink)";
          return (
            <span
              className="block text-right font-medium tabular-nums"
              data-testid={`stock-on-hand-${info.row.original.sku}`}
              style={{ color }}
            >
              {value}
            </span>
          );
        },
      },
      {
        id: "status",
        header: t("status"),
        size: 90,
        cell: (info) => (
          <StockStatusPill onHand={info.row.original.on_hand} threshold={threshold} />
        ),
      },
      {
        id: "last_movement_at",
        header: t("lastMovement"),
        size: 110,
        cell: (info) => {
          const date = parseDate(info.row.original.last_movement_at);
          if (!date) {
            return <span className="text-[11px] text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          );
        },
      },
      {
        id: "chevron",
        header: () => <span className="sr-only">{t("actions")}</span>,
        size: 36,
        cell: () => (
          <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--orion-ink-3)" }} />
        ),
      },
    ],
    [t, tSizes, format, threshold],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="stock-levels-table"
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
                        : header.column.columnDef.size
                          ? header.column.columnDef.size
                          : undefined,
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
              data-testid="stock-row"
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
