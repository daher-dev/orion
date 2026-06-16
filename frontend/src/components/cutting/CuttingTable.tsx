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
import { sumOutputs, type CuttingOrder } from "@/lib/schemas/cutting";
import { CuttingStatusPill } from "./CuttingStatusPill";

type Props = {
  rows: CuttingOrder[];
  onView: (order: CuttingOrder) => void;
};

function shortId(id: string): string {
  // Mirrors the backend's `_short_id` helper for the "code" the design
  // surfaces in the table. The backend exposes uuids only, so we render
  // the first 8 hex chars uppercased.
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function CuttingTable({ rows, onView }: Props) {
  const t = useTranslations("cutting");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<CuttingOrder>[]>(() => {
    const base: ColumnDef<CuttingOrder>[] = [
      {
        id: "code",
        header: () => t("table.columns.code"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {shortId(row.original.id)}
          </span>
        ),
      },
      {
        id: "spec",
        header: () => t("table.columns.spec"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
              {row.original.spec.name}
            </span>
            <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
              {row.original.spec.code}
            </span>
          </div>
        ),
      },
      {
        id: "color",
        header: () => t("table.columns.color"),
        cell: ({ row }) => (
          <span className="text-[13px] text-[color:var(--orion-ink-2)]">
            {row.original.color}
          </span>
        ),
      },
      {
        id: "body_roll",
        header: () => t("table.columns.bodyRoll"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
            {row.original.body_roll.code}
          </span>
        ),
      },
      {
        id: "rib_roll",
        header: () => t("table.columns.ribRoll"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
            {row.original.rib_roll?.code ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("table.columns.status"),
        cell: ({ row }) => <CuttingStatusPill status={row.original.status} />,
      },
      {
        id: "planned_total",
        header: () => t("table.columns.plannedTotal"),
        cell: ({ row }) => (
          <span
            className="text-[13px] text-[color:var(--orion-ink-2)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {sumOutputs(row.original.planned_outputs)}
          </span>
        ),
      },
      {
        id: "actual_total",
        header: () => t("table.columns.actualTotal"),
        cell: ({ row }) => {
          const planned = sumOutputs(row.original.planned_outputs);
          const actual = sumOutputs(row.original.actual_outputs);
          return (
            <span
              className="text-[13px] text-[color:var(--orion-ink-2)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {actual}
              <span className="text-[color:var(--orion-ink-3)]"> / {planned}</span>
            </span>
          );
        },
      },
      {
        id: "cut_at",
        header: () => t("table.columns.cutAt"),
        cell: ({ row }) => {
          const value = row.original.cut_at;
          if (!value) return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          );
        },
      },
    ];

    // Row-end chevron — the whole row is the click target; delete lives
    // in the detail drawer that opens on click.
    base.push({
      id: "chevron",
      header: () => null,
      cell: () => (
        <div className="flex items-center justify-end">
          <ChevronRight
            aria-hidden
            size={14}
            strokeWidth={1.8}
            className="text-[color:var(--orion-ink-3)]"
          />
        </div>
      ),
    });
    return base;
  }, [format, t]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
        {/* .tbl — direct port of /docs/design/source/styles.css */}
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      header.column.id === "actions" ? "text-right" : ""
                    }`}
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
            {table.getRowModel().rows.map((row, idx, arr) => (
              <tr
                key={row.id}
                className="cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
                onClick={() => onView(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                      idx < arr.length - 1
                        ? "border-b border-[color:var(--orion-line-soft)]"
                        : ""
                    } ${cell.column.id === "actions" ? "text-right" : ""}`}
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
