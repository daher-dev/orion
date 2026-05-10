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
  ChevronsUpDown,
  ChevronUp,
  Pencil,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
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
import { useDeleteClient } from "@/hooks/use-clients";
import { useCanAccess } from "@/hooks/use-permissions";
import type { ClientRead } from "@/lib/schemas/client";
import { toast } from "sonner";

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

const avBg = (id: string) => {
  // Same palette idea as design's clientColor in sales.jsx — pick from a
  // deterministic list seeded by the last char of the id.
  const palette = [
    "var(--brand-sales)",
    "var(--brand-prod)",
    "var(--brand-catalog)",
    "var(--brand-reports)",
    "var(--brand-inv)",
  ];
  const last = id.length > 0 ? id.charCodeAt(id.length - 1) : 0;
  return palette[last % palette.length];
};

function Avatar({ name, id }: { name: string; id: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
};

export function ClientsTable({ rows, onEdit }: ClientsTableProps) {
  const t = useTranslations("clients");
  const locale = useLocale();
  const canWrite = useCanAccess("clients.write");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pendingDelete, setPendingDelete] = useState<ClientRead | null>(null);
  const deleteClient = useDeleteClient();

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
        accessorKey: "created_at",
        header: () => t("table.columns.created"),
        cell: ({ row }) => (
          <span
            className={`${cellInkClasses} font-variant-numeric: tabular-nums text-[12px]`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {dateFormatter.format(new Date(row.original.created_at))}
          </span>
        ),
      },
    ];

    if (canWrite) {
      base.push({
        id: "actions",
        header: () => (
          <span className="sr-only">{t("table.columns.actions")}</span>
        ),
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
          </div>
        ),
        enableSorting: false,
      });
    }
    return base;
  }, [canWrite, dateFormatter, onEdit, t]);

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
      await deleteClient.mutateAsync(pendingDelete.id);
      toast.success(t("form.toasts.deleted"));
      setPendingDelete(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <>
      {/* .tbl — full width, separate borders, 13px body. */}
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
              className="group/tbl-row hover:[&_td]:bg-[color:var(--orion-bg)]"
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-[color:var(--brand-sales)]" />
              {t("actions.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClient.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteClient.isPending}
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
