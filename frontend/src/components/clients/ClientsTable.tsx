"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Users as UsersIcon,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import type { ClientRead } from "@/lib/schemas/client";

/**
 * Table mirroring `.tbl` from /docs/design/source/styles.css:
 *   - thead th: 10.5px uppercase tracking .08em weight 600 ink-3, padding 10 14,
 *     border-bottom 1px line, bg = page bg
 *   - tbody td: 12 14 padding, border-bottom 1px line-soft, ink-2, vertical mid
 *   - tbody tr:hover td: bg page bg
 *   - last row: no border bottom
 *   - .num: tabular nums, right aligned
 */

const cellInkClasses = "text-[color:var(--orion-ink-2)]";
const cellLinkInkClasses = "font-medium text-[color:var(--orion-ink)]";

/**
 * Direct port of design's `clientColor` from
 * /docs/design/source/pages/sales.jsx line 437:
 *
 *   const clientColor = (id) =>
 *     ['#c2410c','#0f766e','#7e5bef','#1e40af','#b45309'][parseInt(id.slice(-1)) % 5];
 *
 * The design seeds on the last id char interpreted as a digit — when the
 * char is non-numeric (typical for our UUIDs) we fall back to a stable
 * char-code hash so the swatch is still deterministic.
 */
const CLIENT_PALETTE = ["#c2410c", "#0f766e", "#7e5bef", "#1e40af", "#b45309"] as const;

const avBg = (id: string) => {
  const last = id.slice(-1);
  const numeric = Number.parseInt(last, 10);
  const idx = Number.isNaN(numeric)
    ? last.charCodeAt(0) % CLIENT_PALETTE.length
    : numeric % CLIENT_PALETTE.length;
  return CLIENT_PALETTE[idx];
};

function Avatar({ name, id }: { name: string; id: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // Design `.av` — 28×28, rounded-full, 11px serif weight 600, white text.
  return (
    <span
      className="inline-grid h-7 w-7 place-items-center rounded-full font-serif text-[11px] font-semibold text-white"
      style={{ background: avBg(id) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export type ClientsTableProps = {
  rows: ClientRead[];
  onEdit: (client: ClientRead) => void;
  onView?: (client: ClientRead) => void;
};

export function ClientsTable({ rows, onEdit, onView }: ClientsTableProps) {
  const t = useTranslations("clients");
  const locale = useLocale();
  const [sorting, setSorting] = useState<SortingState>([]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );

  const columns = useMemo<ColumnDef<ClientRead>[]>(() => {
    const base: ColumnDef<ClientRead>[] = [
      {
        accessorKey: "name",
        header: () => t("table.columns.name"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.name} id={row.original.id} />
            <span className={cellLinkInkClasses}>{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: () => t("table.columns.email"),
        cell: ({ row }) => (
          <span className={cellInkClasses}>{row.original.email ?? "—"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: () => t("table.columns.phone"),
        cell: ({ row }) => (
          <span className={cellInkClasses}>{row.original.phone ?? "—"}</span>
        ),
      },
      {
        accessorKey: "address",
        header: () => t("table.columns.address"),
        cell: ({ row }) => (
          <span className={cellInkClasses}>{row.original.address ?? "—"}</span>
        ),
      },
      {
        accessorKey: "order_count",
        header: () => t("table.columns.orders"),
        cell: ({ row }) => (
          <span
            className={`${cellInkClasses} text-[12px]`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {row.original.order_count}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: () => t("table.columns.created"),
        cell: ({ row }) => (
          <span
            className={`${cellInkClasses} text-[12px]`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {dateFormatter.format(new Date(row.original.created_at))}
          </span>
        ),
      },
    ];

    // Row-end chevron — entire row is the click target; edit + delete both
    // live in the form sheet that opens on click.
    base.push({
      id: "chevron",
      header: () => null,
      cell: () => (
        <div className="flex items-center justify-end">
          <ChevronRight
            aria-hidden
            className="size-3.5 text-[color:var(--orion-ink-3)]"
          />
        </div>
      ),
      enableSorting: false,
    });
    return base;
  }, [dateFormatter, t]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    /* .tbl — full width, separate borders, 13px body. */
    <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    // .tbl th — 10.5px uppercase tracking .08em weight 600 ink-3,
                    // padding 10 14, border-bottom line, bg page bg.
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      sortable ? "cursor-pointer select-none" : ""
                    } ${header.column.id === "actions" ? "text-right" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {sortable ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="size-2.5 opacity-100" />
                        ) : sortDir === "desc" ? (
                          <ChevronDown className="size-2.5 opacity-100" />
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
              className="group/tbl-row cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
              onClick={() => onView ? onView(row.original) : onEdit(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  // .tbl td — 12 14 padding, border-b 1px line-soft, ink-2,
                  // vertical mid. Last-child rows drop the bottom border.
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
  );
}
