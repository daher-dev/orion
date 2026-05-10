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
  Pencil,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
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
import { useDeletePrint } from "@/hooks/use-prints";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Print } from "@/lib/schemas/print";

const cellInk = "text-[color:var(--orion-ink-2)]";
const cellInkStrong = "font-medium text-[color:var(--orion-ink)]";

/**
 * Deterministic warm radial-gradient swatch for prints that don't have an
 * image_url yet — mirrors the design's `tone` tile (28×28 rounded-6, palette
 * icon centered).
 */
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
  const hue = (id.charCodeAt(id.length - 1) * 37) % 360;
  return (
    <span
      aria-hidden
      className="grid size-7 place-items-center rounded-[6px] text-white/85"
      style={{
        background: `radial-gradient(circle at 30% 30%, oklch(0.68 0.18 ${hue}), oklch(0.42 0.12 ${(hue + 30) % 360}))`,
      }}
    >
      <Palette size={13} />
    </span>
  );
}

export type PrintsTableProps = {
  rows: Print[];
  onEdit: (print: Print) => void;
};

export function PrintsTable({ rows, onEdit }: PrintsTableProps) {
  const t = useTranslations("prints");
  const locale = useLocale();
  const canWrite = useCanAccess("prints.write");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pendingDelete, setPendingDelete] = useState<Print | null>(null);
  const deletePrint = useDeletePrint();

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: locale.startsWith("pt") ? "BRL" : "USD",
      }),
    [locale],
  );

  const columns = useMemo<ColumnDef<Print>[]>(() => {
    const base: ColumnDef<Print>[] = [
      {
        id: "art",
        header: () => null,
        cell: ({ row }) => <ArtTile id={row.original.id} src={row.original.image_url} />,
        enableSorting: false,
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
          <span
            className={`${cellInk} text-right`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {moneyFormatter.format(Number(row.original.cost_per_unit || 0))}
          </span>
        ),
      },
    ];

    if (canWrite) {
      base.push({
        id: "actions",
        header: () => <span className="sr-only">{t("table.columns.actions")}</span>,
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
        enableSorting: false,
      });
    }

    return base;
  }, [canWrite, moneyFormatter, onEdit, t]);

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
      await deletePrint.mutateAsync(pendingDelete.id);
      toast.success(t("form.toasts.deleted"));
      setPendingDelete(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                const numCol = header.column.id === "cost_per_unit";
                return (
                  <th
                    key={header.id}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      sortable ? "cursor-pointer select-none" : ""
                    } ${numCol || header.column.id === "actions" ? "text-right" : ""}`}
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
              {row.getVisibleCells().map((cell) => {
                const numCol = cell.column.id === "cost_per_unit";
                return (
                  <td
                    key={cell.id}
                    className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                      idx < arr.length - 1
                        ? "border-b border-[color:var(--orion-line-soft)]"
                        : ""
                    } ${numCol || cell.column.id === "actions" ? "text-right" : ""}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
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
              <Palette className="size-4 text-[color:var(--brand-catalog)]" />
              {t("actions.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePrint.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePrint.isPending}
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
