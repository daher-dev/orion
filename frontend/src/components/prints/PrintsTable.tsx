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
  Palette,
} from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import type { Print } from "@/lib/schemas/print";

const cellInk = "text-[color:var(--orion-ink-2)]";
const cellInkStrong = "font-medium text-[color:var(--orion-ink)]";

/**
 * `TONE_BG` from `/docs/design/source/pages/catalog.jsx` — five paper-warm
 * radial tones used as the cosmetic art tile when a print has no image yet.
 * Cycling through these via the print id stays deterministic per row.
 */
const TONE_BG: ReadonlyArray<readonly [string, string]> = [
  ["#f4d9b8", "#c2410c"], // warm
  ["#efe6d3", "#a16207"], // sand
  ["#d6dfd0", "#3a4a3d"], // moss
  ["#f4f1ea", "#7a7160"], // bone
  ["#dfd9cd", "#57534e"], // stone
];

function ArtTile({ id, src }: { id: string; src: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={28}
        height={28}
        unoptimized
        className="size-7 rounded-[6px] object-cover"
      />
    );
  }
  // Stable pick from TONE_BG using the last id char so each print keeps its
  // own paper-tone identity across page loads.
  const idx = id.length > 0 ? id.charCodeAt(id.length - 1) % TONE_BG.length : 0;
  const [a, b] = TONE_BG[idx]!;
  return (
    <span
      aria-hidden
      className="grid size-7 place-items-center rounded-[6px] text-white/85"
      style={{ background: `radial-gradient(circle at 30% 30%, ${a}, ${b})` }}
    >
      <Palette size={13} />
    </span>
  );
}

export type PrintsTableProps = {
  rows: Print[];
  onEdit: (print: Print) => void;
};

/**
 * Prints list table — direct port of `Prints` from
 * `/docs/design/source/pages/catalog.jsx`. Column order:
 *   art tile + code (mono) + name + cost (num) + chevron.
 *
 * The design source also surfaces a `technique` + `tag` column, but our
 * `Print` schema doesn't carry those fields yet — when the backend ships
 * them they slot in between name and cost without other layout changes.
 */
export function PrintsTable({ rows, onEdit }: PrintsTableProps) {
  const t = useTranslations("prints");
  const format = useFormatter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Print>[]>(() => {
    const base: ColumnDef<Print>[] = [
      {
        id: "art",
        size: 38,
        header: () => null,
        enableSorting: false,
        cell: ({ row }) => <ArtTile id={row.original.id} src={row.original.image_url} />,
      },
      {
        accessorKey: "code",
        header: () => t("table.columns.code"),
        cell: ({ row }) => (
          <span className={`${cellInk} font-mono text-[12px]`}>{row.original.code}</span>
        ),
      },
      {
        accessorKey: "name",
        header: () => t("table.columns.name"),
        cell: ({ row }) => <span className={cellInkStrong}>{row.original.name}</span>,
      },
      {
        accessorKey: "cost_per_unit",
        header: () => t("table.columns.costPerUnit"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] tabular-nums text-[color:var(--orion-ink-2)]">
            {format.number(Number(row.original.cost_per_unit || 0), {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        ),
        meta: { align: "right" },
        sortingFn: (a, b) =>
          Number(a.original.cost_per_unit ?? 0) - Number(b.original.cost_per_unit ?? 0),
      },
    ];

    // Row-end chevron — entire row is the click target. Delete lives in
    // the edit drawer that opens on click.
    base.push({
      id: "chevron",
      header: () => null,
      enableSorting: false,
      size: 36,
      cell: () => (
        <div className="flex items-center justify-end">
          <ChevronRight aria-hidden className="size-3.5 text-[color:var(--orion-ink-3)]" />
        </div>
      ),
    });

    return base;
  }, [format, t]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                const align = (header.column.columnDef.meta as { align?: string } | undefined)
                  ?.align;
                const isActionsCol = header.column.id === "actions";
                return (
                  <th
                    key={header.id}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      sortable ? "cursor-pointer select-none" : ""
                    } ${align === "right" || isActionsCol ? "text-right" : "text-left"}`}
                    style={{ width: header.column.columnDef.size }}
                  >
                    <span
                      className={`inline-flex items-center gap-1 w-full ${
                        align === "right" || isActionsCol ? "justify-end" : "justify-start"
                      }`}
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
              className="group/tbl-row cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
              onClick={() => onEdit(row.original)}
            >
              {row.getVisibleCells().map((cell) => {
                const align = (cell.column.columnDef.meta as { align?: string } | undefined)
                  ?.align;
                const isActionsCol = cell.column.id === "actions";
                return (
                  <td
                    key={cell.id}
                    className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                      idx < arr.length - 1
                        ? "border-b border-[color:var(--orion-line-soft)]"
                        : ""
                    } ${align === "right" || isActionsCol ? "text-right" : "text-left"}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
  );
}
