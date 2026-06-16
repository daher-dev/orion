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
  FileText,
  Palette,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { GarmentGlyph } from "@/components/ui/garment-glyph";
import type { Product, Size } from "@/lib/schemas/product";

export type ProductsTableProps = {
  rows: Product[];
  specCodeById: Record<string, string>;
  printCodeById: Record<string, string>;
  printImageById: Record<string, string | null>;
  onEdit: (product: Product) => void;
};

/**
 * Maps the three-letter design source color codes to their swatch hex.
 * Anything unknown falls back to a neutral stone — never a brand color.
 */
const COLOR_HEX_BY_CODE: Record<string, string> = {
  PRT: "#1f1f1f",
  OFF: "#f4f1ea",
  MAR: "#7a4b2a",
  ARE: "#c9b9a3",
  BEG: "#cfb98e",
  MUS: "#7a8a76",
  VRD: "#3a4a3d",
  CAR: "#6b4a2e",
  VRM: "#b03a2e",
  AZM: "#2a3b5a",
};

const SIZE_ORDER: Size[] = ["p", "m", "g", "gg"];

function uniqueColorCodes(p: Product): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of p.variations) {
    if (seen.has(v.color_code)) continue;
    seen.add(v.color_code);
    out.push(v.color_code);
  }
  return out;
}

function uniqueSizes(p: Product): Size[] {
  const seen = new Set<Size>();
  for (const v of p.variations) seen.add(v.size);
  return SIZE_ORDER.filter((s) => seen.has(s));
}

/**
 * Products list table — direct port of `Products` from
 * `/docs/design/source/pages/catalog.jsx`. Column order:
 *   glyph + spec code (mono) + product name + spec icon + print icon +
 *   colors swatches + sizes pills + chevron.
 *
 * The design source has a `code` column derived from the product itself.
 * Our backend doesn't carry a product-level code, so we surface the spec
 * code in that slot — the spec is the recipe identity and the design
 * source displays e.g. "CRP-OVS" right next to the spec column anyway.
 */
export function ProductsTable({
  rows,
  specCodeById,
  printCodeById,
  printImageById,
  onEdit,
}: ProductsTableProps) {
  const t = useTranslations("products");
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Product>[]>(() => {
    const base: ColumnDef<Product>[] = [
      {
        id: "glyph",
        header: () => null,
        size: 38,
        enableSorting: false,
        cell: ({ row }) => {
          const printId = row.original.print_id;
          const imgSrc = printId ? printImageById[printId] : null;
          return (
            <span
              aria-hidden
              className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[6px] text-[color:var(--orion-ink-2)]"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--brand-catalog) 22%, var(--orion-surface)), color-mix(in oklab, var(--brand-catalog) 6%, var(--orion-surface)))",
              }}
            >
              {imgSrc ? (
                <Image
                  src={imgSrc}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <GarmentGlyph
                  productType={row.original.product_type}
                  size={14}
                  className="text-[color:var(--orion-ink-3)]"
                />
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "name",
        header: () => t("table.columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-[color:var(--orion-ink)]">{row.original.name}</span>
        ),
      },
      {
        id: "spec",
        header: () => t("table.columns.spec"),
        cell: ({ row }) => {
          const code = specCodeById[row.original.spec_id] ?? row.original.spec_id.slice(0, 8);
          return (
            <span className="inline-flex items-center gap-1.5 text-[color:var(--orion-ink-2)]">
              <FileText className="size-3 text-[color:var(--orion-ink-3)]" />
              <span className="font-mono text-[12px]">{code}</span>
            </span>
          );
        },
      },
      {
        id: "print",
        header: () => t("table.columns.print"),
        cell: ({ row }) => {
          const printId = row.original.print_id;
          if (!printId) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          const code = printCodeById[printId] ?? printId.slice(0, 8);
          return (
            <span className="inline-flex items-center gap-1.5 text-[color:var(--orion-ink-2)]">
              <Palette className="size-3 text-[color:var(--orion-ink-3)]" />
              <span className="font-mono text-[12px]">{code}</span>
            </span>
          );
        },
      },
      {
        id: "colors",
        header: () => t("table.columns.colors"),
        enableSorting: false,
        cell: ({ row }) => {
          const codes = uniqueColorCodes(row.original);
          if (codes.length === 0) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span className="inline-flex items-center gap-[3px]">
              {codes.slice(0, 4).map((c) => (
                <span
                  key={c}
                  aria-label={c}
                  className="inline-block size-[14px] rounded-full border-[1.5px] border-[color:var(--orion-surface)] shadow-[0_0_0_1px_var(--orion-line)]"
                  style={{ background: COLOR_HEX_BY_CODE[c] ?? "var(--orion-surface-2)" }}
                />
              ))}
              {codes.length > 4 ? (
                <span className="ml-1 text-[11px] text-[color:var(--orion-ink-3)] tabular-nums">
                  +{codes.length - 4}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "sizes",
        header: () => t("table.columns.sizes"),
        enableSorting: false,
        cell: ({ row }) => {
          const sizes = uniqueSizes(row.original);
          if (sizes.length === 0) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span className="text-[11.5px] text-[color:var(--orion-ink-3)] tabular-nums">
              {sizes.map((s) => t(`variations.sizes.${s}`)).join(" · ")}
            </span>
          );
        },
      },
      {
        id: "variations",
        accessorFn: (row) => row.variations.length,
        header: () => t("table.columns.variations"),
        cell: ({ row }) => (
          <span className="text-[11.5px] text-[color:var(--orion-ink-3)] tabular-nums">
            {row.original.variations.length}
          </span>
        ),
        meta: { align: "right" },
      },
    ];

    // Row-end chevron — entire row is the click target. Edit + delete both
     // live in the form sheet that opens on click; the table itself stays
     // free of inline action icons.
    base.push({
      id: "chevron",
      header: () => null,
      enableSorting: false,
      size: 36,
      cell: () => (
        <div className="flex items-center justify-end">
          <ChevronRight
            aria-hidden
            className="size-3.5 text-[color:var(--orion-ink-3)]"
          />
        </div>
      ),
    });

    return base;
  }, [printCodeById, printImageById, specCodeById, t]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table
      className="w-full border-separate border-spacing-0 text-[13px]"
      data-testid="products-table"
    >
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
