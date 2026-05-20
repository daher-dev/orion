"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { VariationStockRead } from "@/lib/schemas/stock";
import { StockStatusPill } from "@/components/stock/StockStatusPill";

type Props = {
  data: VariationStockRead[];
  threshold: number;
  onRowClick: (row: VariationStockRead) => void;
};

type SortDir = "asc" | "desc";
type SortKey = "sku" | "product" | "color" | "size" | "on_hand" | "last_movement_at";
type SortState = { col: SortKey; dir: SortDir };

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
 * Sortable column header — direct port of `SortHeader` from
 * /docs/design/source/pages/inventory.jsx. Click toggles asc/desc; active
 * column shows a colored chevron, inactive shows `chevrons-up-down`.
 */
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
      data-testid={`sort-header-${String(children).toString().toLowerCase()}`}
      onClick={onClick}
      className="inline-flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: active ? "var(--orion-ink)" : "var(--orion-ink-3)",
        userSelect: "none",
        justifyContent: num ? "flex-end" : "flex-start",
      }}
    >
      {children}
      <Icon
        size={11}
        style={{
          color: active ? "var(--brand-inv)" : "var(--orion-ink-3)",
          opacity: active ? 1 : 0.5,
        }}
      />
    </button>
  );
}

/**
 * Variation × on-hand table. Mirrors the inventory.jsx Stock section: SKU mono
 * column, product name + size pill + color swatch, on-hand quantity right-aligned
 * (red if 0, amber if low), status pill, last-movement date.
 *
 * Sort is client-side (the dataset is already small enough). Default order is
 * SKU ascending, matching the design.
 */
export function StockLevelsTable({ data, threshold, onRowClick }: Props) {
  const t = useTranslations("stock.table.columns");
  const tSizes = useTranslations("products.variations.sizes");
  const format = useFormatter();
  const [sort, setSort] = useState<SortState>({ col: "sku", dir: "asc" });

  const sortedData = useMemo(() => {
    const rows = data.slice();
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let av: string | number | null | undefined;
      let bv: string | number | null | undefined;
      switch (sort.col) {
        case "sku":
          av = a.sku;
          bv = b.sku;
          break;
        case "product":
          av = a.product.name;
          bv = b.product.name;
          break;
        case "color":
          av = a.color;
          bv = b.color;
          break;
        case "size":
          av = a.size;
          bv = b.size;
          break;
        case "on_hand":
          av = a.on_hand;
          bv = b.on_hand;
          break;
        case "last_movement_at":
          av = a.last_movement_at ?? "";
          bv = b.last_movement_at ?? "";
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv, "pt-BR") * dir;
      }
      return (((av as number) ?? 0) - ((bv as number) ?? 0)) * dir;
    });
    return rows;
  }, [data, sort]);

  function toggleSort(col: SortKey) {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" },
    );
  }

  const columns = useMemo<ColumnDef<VariationStockRead>[]>(
    () => [
      // .tbl col 1 — Leading 28×28 surface-2 glyph cell (was missing).
      // Design pulls a per-garment glyph from GARMENT_GLYPHS; we don't carry
      // that field on the variation row, so we use a neutral spec/file glyph.
      {
        id: "glyph",
        header: () => null,
        size: 36,
        cell: () => (
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-[6px]"
            style={{
              background: "var(--orion-surface-2)",
              color: "var(--orion-ink-2)",
            }}
          >
            <FileText size={13} strokeWidth={1.4} />
          </span>
        ),
      },
      {
        accessorKey: "sku",
        header: () => (
          <SortableHeader
            active={sort.col === "sku"}
            dir={sort.dir}
            onClick={() => toggleSort("sku")}
          >
            {t("sku")}
          </SortableHeader>
        ),
        size: 160,
        cell: (info) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "product",
        header: () => (
          <SortableHeader
            active={sort.col === "product"}
            dir={sort.dir}
            onClick={() => toggleSort("product")}
          >
            {t("product")}
          </SortableHeader>
        ),
        cell: (info) => (
          <span className="font-medium text-[color:var(--orion-ink)]">
            {info.row.original.product.name}
          </span>
        ),
      },
      {
        id: "color",
        header: () => (
          <SortableHeader
            active={sort.col === "color"}
            dir={sort.dir}
            onClick={() => toggleSort("color")}
          >
            {t("color")}
          </SortableHeader>
        ),
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
      // Size pill — `.pill` styles + font-mono + 600 weight + .04em tracking,
      // 28px min-width centered. Matches inventory.jsx exactly.
      {
        id: "size",
        header: () => (
          <SortableHeader
            active={sort.col === "size"}
            dir={sort.dir}
            onClick={() => toggleSort("size")}
          >
            {t("size")}
          </SortableHeader>
        ),
        size: 80,
        cell: (info) => (
          <span
            className="inline-flex items-center justify-center rounded-full border bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[11.5px] font-semibold tracking-[0.04em] text-[color:var(--orion-ink-2)]"
            style={{
              fontFamily: "var(--font-mono)",
              minWidth: 28,
              borderColor: "var(--orion-line-soft)",
            }}
          >
            {tSizes(info.row.original.size as never)}
          </span>
        ),
      },
      {
        accessorKey: "on_hand",
        header: () => (
          <SortableHeader
            active={sort.col === "on_hand"}
            dir={sort.dir}
            num
            onClick={() => toggleSort("on_hand")}
          >
            {t("onHand")}
          </SortableHeader>
        ),
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
        header: () => (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
            {t("status")}
          </span>
        ),
        size: 90,
        cell: (info) => (
          <StockStatusPill onHand={info.row.original.on_hand} threshold={threshold} />
        ),
      },
      {
        id: "last_movement_at",
        header: () => (
          <SortableHeader
            active={sort.col === "last_movement_at"}
            dir={sort.dir}
            onClick={() => toggleSort("last_movement_at")}
          >
            {t("lastMovement")}
          </SortableHeader>
        ),
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
    [t, tSizes, format, threshold, sort],
  );

  const table = useReactTable({
    data: sortedData,
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
                  className="text-left"
                  style={{
                    padding: "10px 14px",
                    background: "var(--orion-bg)",
                    borderBottom: "1px solid var(--orion-line)",
                    width:
                      header.id === "chevron" || header.id === "glyph"
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
