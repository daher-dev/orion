"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { StockMovementRead } from "@/lib/schemas/stock";

type Props = {
  data: StockMovementRead[];
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Full ledger table — used inline on the `/stock/movements` page and as the body
 * of the per-variation movements drawer. Mirrors the inventory.jsx Stock
 * Movements tab.
 */
export function MovementsTable({ data }: Props) {
  const t = useTranslations("stock.movements.columns");
  const tTypes = useTranslations("stock.movements.types");
  const tSources = useTranslations("stock.movements.sources");
  const tReasons = useTranslations("stock.movements.reasons");
  const tEmpty = useTranslations("stock.movements");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<StockMovementRead>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: t("when"),
        size: 130,
        cell: (info) => {
          const date = parseDate(info.getValue() as string);
          if (!date) return null;
          return (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "sku",
        header: t("sku"),
        size: 140,
        cell: (info) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        id: "reason",
        header: t("reasonOrSource"),
        cell: (info) => {
          const row = info.row.original;
          const isEntry = row.type === "entry";
          const label = isEntry ? tSources(row.source) : tReasons(row.reason);
          const icon = isEntry ? (
            <ArrowDownCircle size={13} style={{ color: "var(--status-ok)" }} />
          ) : (
            <ArrowUpCircle size={13} style={{ color: "var(--status-err)" }} />
          );
          return (
            <span className="inline-flex items-center gap-1.5">
              {icon}
              <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">
                {label}
              </span>
            </span>
          );
        },
      },
      {
        id: "type",
        header: t("type"),
        size: 90,
        cell: (info) => (
          <span className="text-[12px] text-[color:var(--orion-ink-3)]">
            {tTypes(info.row.original.type)}
          </span>
        ),
      },
      {
        accessorKey: "quantity",
        header: () => <span className="block text-right">{t("quantity")}</span>,
        size: 90,
        cell: (info) => {
          const row = info.row.original;
          const isEntry = row.type === "entry";
          const sign = isEntry ? "+" : "-";
          const color = isEntry ? "var(--status-ok)" : "var(--status-err)";
          return (
            <span
              data-testid={`movement-qty-${row.id}`}
              className="block text-right font-medium tabular-nums"
              style={{ color }}
            >
              {sign}
              {info.getValue() as number}
            </span>
          );
        },
      },
      {
        id: "notes",
        header: t("notes"),
        cell: (info) => (
          <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">
            {info.row.original.notes ?? "—"}
          </span>
        ),
      },
    ],
    [t, tSources, tReasons, tTypes, format],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <div
        data-testid="movements-empty"
        className="px-6 py-12 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
      >
        {tEmpty("empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="movements-table"
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
                    width: header.column.columnDef.size,
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
              data-testid="movement-row"
              className="transition-colors hover:bg-[color:var(--orion-bg)]"
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
