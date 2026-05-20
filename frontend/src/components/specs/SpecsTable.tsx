"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  FileText,
  Underline,
} from "lucide-react";
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
 *
 * Column order matches the design source: glyph + code + name + fabric +
 * GSM (num) + ribana + price (num) + chevron.
 */
export function SpecsTable({ items }: { items: SpecRead[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<SpecRead>[]>(
    () => [
      {
        id: "icon",
        size: 38,
        enableSorting: false,
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
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {row.original.code}
          </span>
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
          <span className="font-mono text-[12px] tabular-nums">
            {row.original.fabric_grammage_gsm}
          </span>
        ),
        meta: { align: "right" },
      },
      {
        id: "ribana",
        // Sort by ribana_weight_pct when present (0 otherwise) — mirrors
        // the design source's `s.ribanaUsa ? s.ribanaPct : 0` comparator.
        accessorFn: (row) => (row.has_ribana ? Number(row.ribana_weight_pct ?? 0) : -1),
        header: () => t("specs.table.columns.ribana"),
        cell: ({ row }) => {
          if (!row.original.has_ribana) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          const pct = row.original.ribana_weight_pct ?? "0";
          return (
            <span className="inline-flex items-center gap-1.5 text-[color:var(--orion-ink-2)]">
              <Underline className="size-3 text-[color:var(--orion-ink-3)]" />
              <span className="tabular-nums">{Number(pct).toFixed(0)}%</span>
            </span>
          );
        },
      },
      {
        accessorKey: "sale_price",
        header: () => t("specs.table.columns.salePrice"),
        cell: ({ row }) => {
          const sale = row.original.sale_price;
          if (!sale || Number(sale) <= 0) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span className="font-mono text-[12px] tabular-nums text-[color:var(--orion-ink-2)]">
              {format.number(Number(sale), { style: "currency", currency: "BRL" })}
            </span>
          );
        },
        meta: { align: "right" },
        sortingFn: (a, b) => Number(a.original.sale_price ?? 0) - Number(b.original.sale_price ?? 0),
      },
      {
        id: "chevron",
        size: 36,
        enableSorting: false,
        cell: () => <ChevronRight className="size-3.5 text-[color:var(--orion-ink-3)]" />,
      },
    ],
    [t, format],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (items.length === 0) {
    return (
      <div
        className="px-6 py-10 text-center text-[13px] text-[color:var(--orion-ink-3)]"
        data-testid="specs-table-empty"
      >
        {t("specs.actions.noResults")}
      </div>
    );
  }

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]" data-testid="specs-table">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              const align = (header.column.columnDef.meta as { align?: string } | undefined)?.align;
              const sortable = header.column.getCanSort();
              const dir = header.column.getIsSorted();
              return (
                <th
                  key={header.id}
                  onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                  className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                    sortable ? "cursor-pointer select-none" : ""
                  } ${align === "right" ? "text-right" : "text-left"}`}
                  style={{ width: header.column.columnDef.size }}
                >
                  <span
                    className={`inline-flex items-center gap-1 ${
                      align === "right" ? "justify-end" : "justify-start"
                    } w-full`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {sortable ? (
                      dir === "asc" ? (
                        <ChevronUp className="size-2.5" />
                      ) : dir === "desc" ? (
                        <ChevronDown className="size-2.5" />
                      ) : (
                        <ChevronsUpDown className="size-2.5 opacity-50" />
                      )
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row, idx, arr) => (
          <tr
            key={row.id}
            data-testid="specs-table-row"
            className="cursor-pointer transition-colors hover:[&_td]:bg-[color:var(--orion-bg)]"
          >
            {row.getVisibleCells().map((cell, index) => {
              const align = (cell.column.columnDef.meta as { align?: string } | undefined)?.align;
              const isCodeCell = cell.column.id === "code";
              return (
                <td
                  key={cell.id}
                  className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                    idx < arr.length - 1
                      ? "border-b border-[color:var(--orion-line-soft)]"
                      : ""
                  } ${align === "right" ? "text-right" : "text-left"}`}
                >
                  <Link
                    href={`/specs/${row.original.id}`}
                    tabIndex={isCodeCell || index === 0 ? 0 : -1}
                    className="block text-inherit no-underline outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[color:var(--brand-catalog)]/40"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Link>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
