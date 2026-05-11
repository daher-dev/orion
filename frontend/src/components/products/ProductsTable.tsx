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
  Pencil,
  Shirt,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteProduct } from "@/hooks/use-products";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Product, ProductType } from "@/lib/schemas/product";

export type ProductsTableProps = {
  rows: Product[];
  specCodeById: Record<string, string>;
  printCodeById: Record<string, string>;
  onEdit: (product: Product) => void;
};

const PRODUCT_TYPE_GLYPH: Record<ProductType, React.ReactNode> = {
  tshirt: <Shirt className="size-3.5" />,
  sweatshirt: <Shirt className="size-3.5" />,
  shorts: <Shirt className="size-3.5" />,
  tanktop: <Shirt className="size-3.5" />,
};

/**
 * Products list table — mirrors the `.tbl` rules from `/docs/design/source/styles.css`.
 *
 * Columns: small glyph cell (28×28 rounded-6 tinted from --accent) + name + spec
 * code (mono) + print code (mono) + variation count + actions.
 */
export function ProductsTable({ rows, specCodeById, printCodeById, onEdit }: ProductsTableProps) {
  const t = useTranslations("products");
  const canWrite = useCanAccess("products.write");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const deleteProduct = useDeleteProduct();

  const columns = useMemo<ColumnDef<Product>[]>(() => {
    const base: ColumnDef<Product>[] = [
      {
        id: "glyph",
        header: () => null,
        size: 38,
        enableSorting: false,
        cell: ({ row }) => (
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-[6px] text-[color:var(--orion-ink-2)]"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--brand-catalog) 22%, var(--orion-surface)), color-mix(in oklab, var(--brand-catalog) 6%, var(--orion-surface)))",
            }}
          >
            {PRODUCT_TYPE_GLYPH[row.original.product_type]}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: () => t("table.columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-[color:var(--orion-ink)]">{row.original.name}</span>
        ),
      },
      {
        id: "product_type",
        accessorKey: "product_type",
        header: () => t("table.columns.type"),
        cell: ({ row }) => (
          <span className="text-[color:var(--orion-ink-2)]">
            {t(`productTypes.${row.original.product_type}`)}
          </span>
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
        id: "variations",
        header: () => t("table.columns.variations"),
        cell: ({ row }) => (
          <span className="text-[11.5px] text-[color:var(--orion-ink-3)] tabular-nums">
            {row.original.variations.length}
          </span>
        ),
      },
    ];

    if (canWrite) {
      base.push({
        id: "actions",
        header: () => <span className="sr-only">{t("table.columns.actions")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("actions.edit")}
              onClick={() => onEdit(row.original)}
              className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("actions.delete")}
              onClick={() => setPendingDelete(row.original)}
              className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
            >
              <Trash2 className="size-3.5" />
            </Button>
            <ChevronRight className="size-3.5 text-[color:var(--orion-ink-3)]" />
          </div>
        ),
      });
    }

    return base;
  }, [canWrite, onEdit, printCodeById, specCodeById, t]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteProduct.mutateAsync(pendingDelete.id);
      toast.success(t("form.toasts.deleted"));
      setPendingDelete(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <>
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
                return (
                  <th
                    key={header.id}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      sortable ? "cursor-pointer select-none" : ""
                    } ${header.column.id === "actions" || header.column.id === "variations" ? "text-right" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
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
            <tr key={row.id} className="group/tbl-row hover:[&_td]:bg-[color:var(--orion-bg)]">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                    idx < arr.length - 1
                      ? "border-b border-[color:var(--orion-line-soft)]"
                      : ""
                  } ${cell.column.id === "actions" || cell.column.id === "variations" ? "text-right" : ""}`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shirt className="size-4 text-[color:var(--brand-catalog)]" />
              {t("actions.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProduct.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
