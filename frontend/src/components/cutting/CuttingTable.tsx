"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
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
import { useDeleteCuttingOrder } from "@/hooks/use-cutting";
import { useCanAccess } from "@/hooks/use-permissions";
import { sumOutputs, type CuttingOrder } from "@/lib/schemas/cutting";
import { CuttingStatusPill } from "./CuttingStatusPill";

type Props = {
  rows: CuttingOrder[];
};

function shortId(id: string): string {
  // Mirrors the backend's `_short_id` helper for the "code" the design
  // surfaces in the table. The backend exposes uuids only, so we render
  // the first 8 hex chars uppercased.
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function CuttingTable({ rows }: Props) {
  const t = useTranslations("cutting");
  const format = useFormatter();
  const canWrite = useCanAccess("cutting.write");
  const [pendingDelete, setPendingDelete] = useState<CuttingOrder | null>(null);
  const deleteOrder = useDeleteCuttingOrder();

  const columns = useMemo<ColumnDef<CuttingOrder>[]>(() => {
    const base: ColumnDef<CuttingOrder>[] = [
      {
        id: "code",
        header: () => t("table.columns.code"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
            {shortId(row.original.id)}
          </span>
        ),
      },
      {
        id: "product",
        header: () => t("table.columns.product"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
              {row.original.product.name}
            </span>
            {row.original.product.code ? (
              <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                {row.original.product.code}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "body_roll",
        header: () => t("table.columns.bodyRoll"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
            {row.original.body_roll.code}
          </span>
        ),
      },
      {
        id: "rib_roll",
        header: () => t("table.columns.ribRoll"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
            {row.original.rib_roll?.code ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("table.columns.status"),
        cell: ({ row }) => <CuttingStatusPill status={row.original.status} />,
      },
      {
        id: "planned_total",
        header: () => t("table.columns.plannedTotal"),
        cell: ({ row }) => (
          <span
            className="text-[13px] text-[color:var(--orion-ink-2)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {sumOutputs(row.original.planned_outputs)}
          </span>
        ),
      },
      {
        id: "actual_total",
        header: () => t("table.columns.actualTotal"),
        cell: ({ row }) => {
          const planned = sumOutputs(row.original.planned_outputs);
          const actual = sumOutputs(row.original.actual_outputs);
          return (
            <span
              className="text-[13px] text-[color:var(--orion-ink-2)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {actual}
              <span className="text-[color:var(--orion-ink-3)]"> / {planned}</span>
            </span>
          );
        },
      },
      {
        id: "cut_at",
        header: () => t("table.columns.cutAt"),
        cell: ({ row }) => {
          const value = row.original.cut_at;
          if (!value) return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          );
        },
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
              aria-label={t("actions.delete")}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(row.original);
              }}
              className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--status-err)]"
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </Button>
          </div>
        ),
      });
    }
    return base;
  }, [canWrite, format, t]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteOrder.mutateAsync(pendingDelete.id);
      toast.success(t("form.toasts.deleted"));
      setPendingDelete(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        {/* .tbl — direct port of /docs/design/source/styles.css */}
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      header.column.id === "actions" ? "text-right" : ""
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, idx, arr) => (
              <tr key={row.id} className="hover:[&_td]:bg-[color:var(--orion-bg)]">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
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
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrder.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteOrder.isPending}
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
