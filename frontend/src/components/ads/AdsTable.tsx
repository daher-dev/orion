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
  Shirt,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ad } from "@/lib/schemas/ad";
import { CHANNEL_THEME } from "./channel-theme";

/**
 * Table mirroring `/docs/design/source/pages/sales.jsx` Ads (lines 662-692).
 *
 * Columns from the design: glyph (channel-coloured square), code (mono),
 * title, channel chip, product, chevron-right indicator. We drop the
 * `status` + `orders30d` columns because those metrics aren't surfaced by
 * the backend yet — the layout matches the design otherwise.
 */
type Props = {
  rows: Ad[];
  onEdit: (ad: Ad) => void;
};

export function AdsTable({ rows, onEdit }: Props) {
  const t = useTranslations("ads");
  const tChannels = useTranslations("ads.channels");
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Ad>[]>(() => {
    const base: ColumnDef<Ad>[] = [
      // Channel-coloured glyph — design line 680: 28×28 rounded-6, channel
      // gradient background, white shirt icon.
      {
        id: "glyph",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) => {
          const theme = CHANNEL_THEME[row.original.ecommerce];
          return (
            <span
              className="inline-grid h-7 w-7 place-items-center rounded-[6px]"
              style={{
                background: `linear-gradient(135deg, ${theme.color}, ${theme.color}aa)`,
                color: "rgba(255,255,255,0.95)",
              }}
              aria-hidden="true"
            >
              <Shirt size={14} strokeWidth={1.5} />
            </span>
          );
        },
      },
      // External code — mono font (design line 681).
      {
        accessorKey: "external_id",
        header: () => t("table.columns.code"),
        cell: ({ row }) =>
          row.original.external_id ? (
            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
              {row.original.external_id}
            </span>
          ) : (
            <span className="text-[12px] italic text-[color:var(--orion-ink-3)]">
              {t("card.noExternalId")}
            </span>
          ),
      },
      // Title — ink, weight 500 (design line 682).
      {
        accessorKey: "title",
        header: () => t("table.columns.title"),
        cell: ({ row }) => (
          <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
            {row.original.title}
          </span>
        ),
      },
      // Channel chip — design line 683 uses the shared `ChannelChip`.
      {
        accessorKey: "ecommerce",
        header: () => t("table.columns.channel"),
        cell: ({ row }) => {
          const theme = CHANNEL_THEME[row.original.ecommerce];
          return (
            <span className="ch-chip inline-flex items-center gap-1.5 rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-1.5 py-[2px] text-[11.5px] font-medium text-[color:var(--orion-ink)]">
              <span
                className="inline-grid h-4 w-4 place-items-center rounded-full text-[8.5px] font-bold"
                style={{ background: theme.color, color: theme.fg }}
                aria-hidden="true"
              >
                {theme.short}
              </span>
              {tChannels(row.original.ecommerce)}
            </span>
          );
        },
      },
      // Product name + code.
      {
        id: "product",
        header: () => t("table.columns.product"),
        cell: ({ row }) => {
          const products = row.original.products;
          const first = products[0];
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[13px] text-[color:var(--orion-ink-2)]">
                {first ? first.name : "—"}
                {products.length > 1 ? ` +${products.length - 1}` : ""}
              </span>
              <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                {first ? first.code : ""}
              </span>
            </div>
          );
        },
      },
    ];

    // Chevron-right indicator — design line 687 places a chevron at the row
    // end as a "view more" affordance. The whole row is clickable; delete
    // lives in the edit drawer, not the table.
    base.push({
      id: "chevron",
      header: () => null,
      enableSorting: false,
      cell: () => (
        <ChevronRight
          size={14}
          strokeWidth={1.8}
          className="text-[color:var(--orion-ink-3)]"
          aria-hidden="true"
        />
      ),
    });
    return base;
  }, [t, tChannels]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto">
        {/* .tbl — direct port of /docs/design/source/styles.css. */}
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const widthClass =
                    header.column.id === "glyph"
                      ? "w-[44px]"
                      : header.column.id === "chevron"
                        ? "w-[36px]"
                        : header.column.id === "actions"
                          ? "w-[44px]"
                          : "";
                  return (
                    <th
                      key={header.id}
                      onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                      className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${widthClass} ${
                        sortable ? "cursor-pointer select-none" : ""
                      } ${header.column.id === "actions" || header.column.id === "chevron" ? "text-right" : ""}`}
                    >
                      <span
                        className={`inline-flex items-center gap-1 ${
                          header.column.id === "actions" || header.column.id === "chevron"
                            ? "justify-end"
                            : ""
                        }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
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
                data-testid={`ad-row-${row.original.id}`}
                onClick={() => onEdit(row.original)}
                className="cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                      idx < arr.length - 1
                        ? "border-b border-[color:var(--orion-line-soft)]"
                        : ""
                    } ${
                      cell.column.id === "actions" || cell.column.id === "chevron"
                        ? "text-right"
                        : ""
                    }`}
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
