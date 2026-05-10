"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight, Layers, Rows3 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { FabricRoll } from "@/lib/schemas/fabric";

type Props = {
  data: FabricRoll[];
  onRowClick: (roll: FabricRoll) => void;
};

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
      {
        accessorKey: "supplier_name",
        header: tColumns("supplier"),
        cell: (info) => (
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-[6px]"
              style={{
                background: "var(--orion-surface-2)",
                color: "var(--orion-ink-2)",
              }}
            >
              {info.row.original.kind === "rib" ? (
                <Rows3 size={15} strokeWidth={1.5} />
              ) : (
                <Layers size={15} strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-[color:var(--orion-ink)]">
                {info.getValue() as string}
              </div>
              <div className="text-[11px] text-[color:var(--orion-ink-3)]">
                {tKinds(info.row.original.kind)} · {tTypes(info.row.original.fabric_type)}
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "color",
        header: tColumns("color"),
        cell: (info) => (
          <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">
            {(info.getValue() as string) || "—"}
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
      {
        accessorKey: "initial_weight_kg",
        header: tColumns("initialWeight"),
        cell: (info) => (
          <span className="font-variant-numeric tabular-nums text-[12.5px] text-[color:var(--orion-ink-2)]">
            {Number(info.getValue()).toFixed(1)} kg
          </span>
        ),
      },
      {
        id: "usage",
        header: tColumns("currentWeight"),
        size: 220,
        cell: (info) => {
          const row = info.row.original;
          const initial = Number(row.initial_weight_kg);
          const current = Number(row.current_weight_kg);
          const remainingPct = initial > 0 ? (current / initial) * 100 : 0;
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
                  style={{
                    width: `${Math.max(0, Math.min(100, remainingPct))}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 999,
                  }}
                />
              </div>
              <span
                className="font-variant-numeric tabular-nums text-[11.5px]"
                style={{
                  minWidth: 64,
                  color: remainingPct < 25 ? "var(--status-err)" : "var(--orion-ink-2)",
                  textAlign: "right",
                  fontWeight: 500,
                }}
              >
                {Number(current).toFixed(1)} kg
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "price_per_kg",
        header: tColumns("pricePerKg"),
        cell: (info) => (
          <span className="font-variant-numeric tabular-nums text-[12.5px] text-[color:var(--orion-ink-2)]">
            {format.number(Number(info.getValue()), { style: "currency", currency: "BRL" })}
          </span>
        ),
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
                    width: header.id === "chevron" ? 36 : header.id === "usage" ? 220 : undefined,
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
