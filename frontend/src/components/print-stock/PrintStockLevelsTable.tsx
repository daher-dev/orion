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
  Stamp,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { PrintStockLevelRead } from "@/lib/schemas/print-stock";
import { PrintStockStatusPill } from "@/components/print-stock/PrintStockStatusPill";

type Props = {
  data: PrintStockLevelRead[];
  threshold: number;
  onRowClick: (row: PrintStockLevelRead) => void;
};

type SortDir = "asc" | "desc";
type SortKey = "design" | "color" | "on_hand" | "last_movement_at";
type SortState = { col: SortKey; dir: SortDir };

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Estampa thumbnail chip — image when present, else a Stamp glyph. */
function PrintThumb({ row }: { row: PrintStockLevelRead }) {
  const url = row.design.image_url;
  return (
    <span
      aria-hidden
      className="grid size-9 flex-shrink-0 place-items-center overflow-hidden rounded-[8px]"
      style={{
        background: "var(--orion-surface-2)",
        color: "var(--orion-ink-2)",
        boxShadow: "inset 0 0 0 1px var(--orion-line-soft)",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <Stamp size={15} strokeWidth={1.5} />
      )}
    </span>
  );
}

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
 * (estampa × cor) × on-hand table. Mirrors the inventory.jsx Stock section but
 * keyed on the printed-stamp dimension: estampa code/name + thumbnail, product
 * colour, printed on-hand (red if 0, amber if low), status pill, last movement.
 */
export function PrintStockLevelsTable({ data, threshold, onRowClick }: Props) {
  const t = useTranslations("printStock.table.columns");
  const format = useFormatter();
  const [sort, setSort] = useState<SortState>({ col: "design", dir: "asc" });

  const sortedData = useMemo(() => {
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
        case "color":
          av = a.product_color;
          bv = b.product_color;
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
      prev.col === col ? { col, dir: prev.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" },
    );
  }

  const columns = useMemo<ColumnDef<PrintStockLevelRead>[]>(
    () => [
      {
        id: "thumb",
        header: () => null,
        size: 44,
        cell: (info) => <PrintThumb row={info.row.original} />,
      },
      {
        id: "design",
        header: () => (
          <SortableHeader active={sort.col === "design"} dir={sort.dir} onClick={() => toggleSort("design")}>
            {t("design")}
          </SortableHeader>
        ),
        cell: (info) => (
          <span className="flex flex-col">
            <span className="font-medium text-[color:var(--orion-ink)]">{info.row.original.design.name}</span>
            <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
              {info.row.original.design.code}
            </span>
          </span>
        ),
      },
      {
        id: "color",
        header: () => (
          <SortableHeader active={sort.col === "color"} dir={sort.dir} onClick={() => toggleSort("color")}>
            {t("color")}
          </SortableHeader>
        ),
        cell: (info) => (
          <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">{info.row.original.product_color}</span>
        ),
      },
      {
        accessorKey: "on_hand",
        header: () => (
          <SortableHeader active={sort.col === "on_hand"} dir={sort.dir} num onClick={() => toggleSort("on_hand")}>
            {t("onHand")}
          </SortableHeader>
        ),
        size: 100,
        cell: (info) => {
          const value = info.getValue() as number;
          const color =
            value <= 0
              ? "var(--status-err)"
              : value <= threshold
                ? "var(--status-warn)"
                : "var(--orion-ink)";
          return (
            <span
              className="block text-right font-medium tabular-nums"
              data-testid={`print-stock-on-hand-${info.row.original.print_design_id}-${info.row.original.product_color}`}
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
        cell: (info) => <PrintStockStatusPill onHand={info.row.original.on_hand} threshold={threshold} />,
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
        size: 120,
        cell: (info) => {
          const date = parseDate(info.row.original.last_movement_at);
          if (!date) return <span className="text-[11px] text-[color:var(--orion-ink-3)]">—</span>;
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
        cell: () => <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--orion-ink-3)" }} />,
      },
    ],
    [t, format, threshold, sort],
  );

  const table = useReactTable({
    data: sortedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="print-stock-levels-table"
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
              data-testid="print-stock-row"
              onClick={() => onRowClick(row.original)}
              className="cursor-pointer transition-colors hover:bg-[color:var(--orion-bg)]"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom: index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
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
