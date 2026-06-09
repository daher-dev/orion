"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDownCircle, ArrowUpCircle, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { PrintStockMovementRead } from "@/lib/schemas/print-stock";

type Props = {
  data: PrintStockMovementRead[];
  /** Hide the estampa column when rendered inside a single-design drawer. */
  showDesign?: boolean;
};

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Full printed-stamp ledger table — used on the page and inside the drawer. */
export function PrintStockMovementsTable({ data, showDesign = true }: Props) {
  const t = useTranslations("printStock.movements.columns");
  const tDir = useTranslations("printStock.movements.directions");
  const tEmpty = useTranslations("printStock.movements");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<PrintStockMovementRead>[]>(() => {
    const cols: ColumnDef<PrintStockMovementRead>[] = [
      {
        accessorKey: "created_at",
        header: t("when"),
        size: 150,
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
    ];
    if (showDesign) {
      cols.push({
        id: "design",
        header: t("design"),
        cell: (info) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {info.row.original.design?.code ?? "—"}
          </span>
        ),
      });
    }
    cols.push(
      {
        id: "color",
        header: t("color"),
        size: 130,
        cell: (info) => (
          <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">{info.row.original.product_color}</span>
        ),
      },
      {
        id: "direction",
        header: t("direction"),
        size: 130,
        cell: (info) => {
          const dir = info.row.original.direction;
          const icon =
            dir === "exit" ? (
              <ArrowUpCircle size={13} style={{ color: "var(--status-err)" }} />
            ) : dir === "adjustment" ? (
              <RefreshCw size={13} style={{ color: "var(--status-warn)" }} />
            ) : (
              <ArrowDownCircle size={13} style={{ color: "var(--status-ok)" }} />
            );
          return (
            <span className="inline-flex items-center gap-1.5">
              {icon}
              <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">{tDir(dir)}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: () => <span className="block text-right">{t("quantity")}</span>,
        size: 90,
        cell: (info) => {
          const row = info.row.original;
          const isExit = row.direction === "exit";
          const sign = isExit ? "-" : "+";
          const color = isExit ? "var(--status-err)" : "var(--status-ok)";
          return (
            <span
              data-testid={`print-movement-qty-${row.id}`}
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
          <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">{info.row.original.notes ?? "—"}</span>
        ),
      },
    );
    return cols;
  }, [t, tDir, format, showDesign]);

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (data.length === 0) {
    return (
      <div
        data-testid="print-movements-empty"
        className="px-6 py-12 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
      >
        {tEmpty("empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="print-movements-table"
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
              data-testid="print-movement-row"
              className="transition-colors hover:bg-[color:var(--orion-bg)]"
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
