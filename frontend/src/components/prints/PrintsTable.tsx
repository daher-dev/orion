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
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Palette,
} from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { InkChip } from "@/components/prints/variations/InkChip";
import type { Print, PrintVariation } from "@/lib/schemas/print";

/** Pending PNGs across a variation's active sides. */
function variationPending(print: Print, v: PrintVariation): number {
  let pending = 0;
  if (print.has_front || (!print.has_front && !print.has_back)) {
    if (v.front_status !== "ok") pending += 1;
  }
  if (print.has_back && v.back_status !== "ok") pending += 1;
  return pending;
}

/** Row of ink chips + a pending-PNG badge. Port of `VariationPips`. */
function VariationPips({ print }: { print: Print }) {
  const variations = print.variations ?? [];
  const totalPending = variations.reduce((n, v) => n + variationPending(print, v), 0);
  if (variations.length === 0) {
    return <span className="text-[color:var(--orion-ink-3)]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="variation-pips">
      <span className="inline-flex gap-[5px]">
        {variations.slice(0, 4).map((v) => (
          <InkChip
            key={v.id}
            ink={v.ink_hex}
            ready={variationPending(print, v) === 0}
            size={16}
            title={v.name}
          />
        ))}
        {variations.length > 4 ? (
          <span className="self-center text-[11px] text-[color:var(--orion-ink-3)]">
            +{variations.length - 4}
          </span>
        ) : null}
      </span>
      {totalPending > 0 ? (
        <span className="inline-flex items-center gap-[3px] rounded-full bg-[color:color-mix(in_oklab,var(--status-warn)_14%,var(--orion-surface))] px-[7px] py-px text-[10.5px] font-semibold text-[color:var(--status-warn)]">
          <AlertCircle className="size-2.5" /> {totalPending} PNG
        </span>
      ) : null}
    </span>
  );
}

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
  onOpen: (print: Print) => void;
};

/**
 * Prints list table — ports `Prints` from `docs/design/pages/catalog.jsx`.
 * Column order: art tile + code (mono) + name + technique + cost (num) + tag + chevron.
 * A row opens the print detail view.
 */
export function PrintsTable({ rows, onOpen }: PrintsTableProps) {
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
        accessorKey: "technique",
        header: () => t("table.columns.technique"),
        cell: ({ row }) => (
          <span className={cellInk}>{t(`techniques.${row.original.technique}`)}</span>
        ),
      },
      {
        id: "variations",
        header: () => t("variations.countLabel"),
        enableSorting: false,
        cell: ({ row }) => <VariationPips print={row.original} />,
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
      {
        accessorKey: "tag",
        header: () => t("table.columns.tag"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.tag ? (
            <span className="inline-flex items-center rounded-full bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[11px] text-[color:var(--orion-ink-2)]">
              {row.original.tag}
            </span>
          ) : (
            <span className="text-[color:var(--orion-ink-3)]">—</span>
          ),
      },
    ];

    // Row-end chevron — entire row is the click target, opening the detail view.
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
              onClick={() => onOpen(row.original)}
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
