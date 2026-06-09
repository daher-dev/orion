"use client";

import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ChevronRight, FlaskConical } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { SupplyLevelRead } from "@/lib/schemas/supply";

type Props = {
  data: SupplyLevelRead[];
  onRowClick: (level: SupplyLevelRead) => void;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A supply is "low" when it has a threshold AND on-hand is at or below it. */
function isLow(level: SupplyLevelRead): boolean {
  if (level.min_stock === null || level.min_stock === undefined || level.min_stock === "") return false;
  return Number(level.on_hand) <= Number(level.min_stock);
}

function trimDecimals(value: string): string {
  // 12.000 -> 12 ; 12.500 -> 12.5 — keeps the on-hand column tidy.
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return String(n);
}

export function SuppliesTable({ data, onRowClick }: Props) {
  const t = useTranslations("supplies");
  const tColumns = useTranslations("supplies.table.columns");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<SupplyLevelRead>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: tColumns("name"),
        cell: (info) => (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[6px]"
              style={{ background: "var(--orion-surface-2)", color: "var(--orion-ink-2)" }}
            >
              <FlaskConical size={15} strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-[color:var(--orion-ink)]">
                {info.row.original.name}
              </div>
              <div className="text-[11px] text-[color:var(--orion-ink-3)]">
                {info.row.original.unit}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "on_hand",
        accessorKey: "on_hand",
        header: () => <span className="block text-right">{tColumns("onHand")}</span>,
        size: 120,
        cell: (info) => {
          const level = info.row.original;
          const low = isLow(level);
          return (
            <span
              data-testid="supply-on-hand"
              className="block text-right font-variant-numeric tabular-nums"
              style={{ color: low ? "var(--status-err)" : "var(--orion-ink)", fontWeight: 500 }}
            >
              {trimDecimals(level.on_hand)} {level.unit}
            </span>
          );
        },
      },
      {
        id: "unit_cost",
        accessorKey: "unit_cost",
        header: () => <span className="block text-right">{tColumns("unitCost")}</span>,
        size: 110,
        cell: (info) => (
          <span className="block text-right font-variant-numeric tabular-nums text-[12.5px] text-[color:var(--orion-ink-2)]">
            {format.number(Number(info.getValue() as string), { style: "currency", currency: "BRL" })}
          </span>
        ),
      },
      {
        id: "last_movement_at",
        accessorKey: "last_movement_at",
        header: tColumns("lastMovement"),
        size: 120,
        cell: (info) => {
          const date = parseDate(info.getValue() as string | null);
          if (!date) return <span className="text-[12px] text-[color:var(--orion-ink-3)]">—</span>;
          return (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          );
        },
      },
      {
        id: "chevron",
        header: () => <span className="sr-only">{tColumns("actions")}</span>,
        size: 36,
        cell: () => <ChevronRight size={14} strokeWidth={1.8} style={{ color: "var(--orion-ink-3)" }} />,
      },
    ],
    [format, tColumns],
  );

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto" data-supplies-table-locale={t("page.eyebrow")}>
      <table
        data-testid="supplies-table"
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
                    width: header.id === "chevron" ? 36 : header.column.columnDef.size,
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
              data-testid="supply-row"
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
