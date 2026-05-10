"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronRight, FileText } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { SpecRead } from "@/lib/schemas/spec";

const FABRIC_LABEL_KEY = "specs.fabricTypes" as const;

/**
 * The list table from `/docs/design/source/pages/catalog.jsx` (Specs).
 * Mirrors the `.tbl` rules from styles.css:
 *   th — 10.5px / 0.08em / uppercase / 600 / ink-3 / 10px 14px / border-bottom line / bg paper
 *   td — 12px 14px / line-soft border-bottom / ink-2
 *   .num — tabular-nums / right-aligned
 *   .mono — JetBrains 12px / ink
 */
export function SpecsTable({ items }: { items: SpecRead[] }) {
  const t = useTranslations();
  const format = useFormatter();

  const columns = useMemo<ColumnDef<SpecRead>[]>(
    () => [
      {
        id: "icon",
        size: 38,
        cell: () => (
          <span
            className="grid h-7 w-7 place-items-center rounded-md bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]"
            aria-hidden="true"
          >
            <FileText className="size-3.5" />
          </span>
        ),
      },
      {
        accessorKey: "code",
        header: () => t("specs.table.columns.code"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">{row.original.code}</span>
        ),
      },
      {
        accessorKey: "name",
        header: () => t("specs.table.columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-[color:var(--orion-ink)]">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "fabric_type",
        header: () => t("specs.table.columns.fabricType"),
        cell: ({ row }) => t(`${FABRIC_LABEL_KEY}.${row.original.fabric_type}`),
      },
      {
        accessorKey: "fabric_grammage_gsm",
        header: () => t("specs.table.columns.gsm"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] tabular-nums">{row.original.fabric_grammage_gsm}</span>
        ),
        meta: { align: "right" },
      },
      {
        accessorKey: "labor_cost",
        header: () => t("specs.table.columns.laborCost"),
        cell: ({ row }) =>
          format.number(Number(row.original.labor_cost), {
            style: "currency",
            currency: "BRL",
          }),
        meta: { align: "right" },
      },
      {
        accessorKey: "updated_at",
        header: () => t("specs.table.columns.updatedAt"),
        cell: ({ row }) =>
          format.dateTime(new Date(row.original.updated_at), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
        meta: { align: "right" },
      },
      {
        id: "chevron",
        size: 36,
        cell: () => <ChevronRight className="size-3.5 text-[color:var(--orion-ink-3)]" />,
      },
    ],
    [t, format],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (items.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-[13px] text-[color:var(--orion-ink-3)]" data-testid="specs-table-empty">
        {t("specs.actions.noResults")}
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-[13px]" data-testid="specs-table">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align;
              return (
                <th
                  key={header.id}
                  className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)] ${align === "right" ? "text-right" : "text-left"}`}
                  style={{ width: header.column.columnDef.size }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            data-testid="specs-table-row"
            className="cursor-pointer border-b border-[color:var(--orion-line-soft)] transition-colors last:border-b-0 hover:bg-[color:var(--orion-bg)]"
          >
            {row.getVisibleCells().map((cell, index) => {
              const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
              const isFirstInteractive = index === 1; // make code cell wrap row in Link
              return (
                <td
                  key={cell.id}
                  className={`px-3.5 py-3 align-middle text-[color:var(--orion-ink-2)] ${align === "right" ? "text-right" : "text-left"}`}
                >
                  {isFirstInteractive ? (
                    <Link
                      href={`/specs/${row.original.id}`}
                      className="block text-inherit no-underline outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[color:var(--brand-catalog)]/40"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  ) : (
                    <Link
                      href={`/specs/${row.original.id}`}
                      tabIndex={-1}
                      className="block text-inherit no-underline"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
