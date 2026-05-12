"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Eye, MoreHorizontal, Shirt, Trash2 } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteOrder } from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import type { Order } from "@/lib/schemas/order";
import { OrderChannelChip } from "./OrderChannelChip";
import { OrderStatusPill } from "./OrderStatusPill";

type Props = {
  rows: Order[];
  onView?: (order: Order) => void;
};

/** ORD-XXXXXXXX code rendered everywhere we surface an order id. */
export function shortOrderCode(id: string): string {
  return `ORD-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function OrdersTable({ rows, onView }: Props) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const locale = useLocale();
  const canWrite = useCanAccess("orders.write");
  const [pendingDelete, setPendingDelete] = useState<Order | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const deleteOrder = useDeleteOrder();
  const router = useRouter();

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
        style: "currency",
        currency: locale === "pt-BR" ? "BRL" : "USD",
      }),
    [locale],
  );

  const columns = useMemo<ColumnDef<Order>[]>(() => {
    const base: ColumnDef<Order>[] = [
      // select — QA-014
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label={t("table.selectAll")}
            className="translate-y-px"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={t("table.selectRow")}
            onClick={(e) => e.stopPropagation()}
            className="translate-y-px"
          />
        ),
        enableSorting: false,
      },
      // code
      {
        id: "code",
        header: () => t("table.columns.code"),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() =>
              onView ? onView(row.original) : router.push(`/orders/${row.original.id}`)
            }
            className="flex flex-col gap-0.5 hover:underline focus-visible:outline-none focus-visible:underline text-left"
            style={{ color: "var(--orion-ink)" }}
          >
            <span className="font-medium text-[13px]">
              {shortOrderCode(row.original.id)}
            </span>
            {row.original.external_order_id ? (
              <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                {row.original.external_order_id}
              </span>
            ) : null}
          </button>
        ),
      },
      // client (before channel — QA-013)
      {
        id: "client",
        header: () => t("table.columns.client"),
        cell: ({ row }) => (
          <span className="text-[13px] text-[color:var(--orion-ink)]">
            {row.original.client.name}
          </span>
        ),
      },
      // channel
      {
        id: "channel",
        header: () => t("table.columns.channel"),
        cell: ({ row }) => <OrderChannelChip channel={row.original.ad.ecommerce} />,
      },
      // product — thumbnail from QA-016
      {
        id: "product",
        header: () => t("table.columns.product"),
        cell: ({ row }) => {
          const v = row.original.variation;
          const imgSrc = v.product.image_url;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="relative inline-grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-[color:var(--orion-line-soft)]"
                style={{ background: "var(--orion-surface-2)" }}
                aria-hidden="true"
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
                  <Shirt
                    size={14}
                    strokeWidth={1.5}
                    className="text-[color:var(--orion-ink-3)]"
                  />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[13px] font-medium text-[color:var(--orion-ink)]">
                  {v.product.name}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--orion-ink-3)]">
                  <span>{v.color}</span>
                  <span
                    className="inline-block rounded-[3px] border border-[color:var(--orion-line-soft)] px-1 py-px font-mono text-[10px] leading-[1.2]"
                  >
                    {v.size.toUpperCase()}
                  </span>
                </span>
              </div>
            </div>
          );
        },
      },
      // qty
      {
        id: "qty",
        header: () => t("table.columns.qty"),
        cell: ({ row }) => (
          <span
            className="text-[13px] text-[color:var(--orion-ink-2)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {row.original.quantity}
          </span>
        ),
      },
      // value
      {
        id: "value",
        header: () => t("table.columns.value"),
        cell: ({ row }) => {
          const unit = Number(row.original.sale_price);
          const total = unit * row.original.quantity;
          return (
            <span
              className="text-[13px] font-medium text-[color:var(--orion-ink)] whitespace-nowrap"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {currency.format(total)}
            </span>
          );
        },
      },
      // status
      {
        id: "status",
        header: () => t("table.columns.status"),
        cell: ({ row }) => <OrderStatusPill status={row.original.status} />,
      },
      // orderedAt
      {
        id: "orderedAt",
        header: () => t("table.columns.orderedAt"),
        cell: ({ row }) => {
          const date = new Date(row.original.ordered_at);
          if (Number.isNaN(date.getTime())) {
            return <span className="text-[color:var(--orion-ink-3)]">—</span>;
          }
          return (
            <span
              className="text-[12px] text-[color:var(--orion-ink-3)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          );
        },
      },
      // actions — ⋯ dropdown (QA-015) with View detail + Delete
      {
        id: "actions",
        header: () => <span className="sr-only">{t("table.columns.actions")}</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("actions.moreActions")}
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-7 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)]"
                >
                  <MoreHorizontal size={14} strokeWidth={1.8} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[150px]">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onView) {
                      onView(row.original);
                    } else {
                      router.push(`/orders/${row.original.id}`);
                    }
                  }}
                  className="gap-2 text-[13px]"
                >
                  <Eye size={13} />
                  {t("actions.viewDetail")}
                </DropdownMenuItem>
                {canWrite ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(row.original);
                      }}
                      className="gap-2 text-[13px] text-[color:var(--status-err)] focus:text-[color:var(--status-err)]"
                    >
                      <Trash2 size={13} />
                      {t("actions.delete")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ];

    return base;
  }, [canWrite, currency, format, onView, router, t]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const table = useReactTable({
    data: rows,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteOrder.mutateAsync(pendingDelete.id);
      toast.success(t("form.toasts.deleted"));
      setPendingDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t("form.toasts.deleteBlocked"));
      } else {
        const detail = err instanceof Error ? err.message : "";
        toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
      }
      setPendingDelete(null);
    }
  }

  return (
    <>
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-4 py-2 text-[12.5px]">
          <span className="font-medium text-[color:var(--orion-ink)]">
            {t("table.selectedCount", { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={() => setRowSelection({})}
            className="text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink)] underline-offset-2 hover:underline"
          >
            {t("table.clearSelection")}
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        {/* .tbl — direct port of /docs/design/source/styles.css */}
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      header.column.id === "select"
                        ? "w-10 px-[14px]"
                        : header.column.id === "qty" || header.column.id === "value"
                          ? "px-[14px] text-right"
                          : header.column.id === "actions"
                            ? "px-[14px] text-right"
                            : "px-[14px]"
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
              <tr
                key={row.id}
                data-testid={`order-row-${row.original.id}`}
                className="hover:[&_td]:bg-[color:var(--orion-bg)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                      idx < arr.length - 1
                        ? "border-b border-[color:var(--orion-line-soft)]"
                        : ""
                    } ${
                      cell.column.id === "qty" || cell.column.id === "value"
                        ? "text-right"
                        : cell.column.id === "actions"
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

/**
 * Tiny deterministic hash that turns a 3-char color code into a CSS color.
 * The Orders model only stores the human label + the 3-letter code (BLK,
 * GRN, etc.), so we surface a representative swatch using a small lookup
 * with a fallback hash. The exact palette ties back to the design's
 * `COLOR_HEX` in `/docs/design/source/pages/sales.jsx`.
 */
function hashColor(code: string): string {
  const palette: Record<string, string> = {
    BLK: "#1f1f1f",
    WHT: "#f4f1ea",
    OFW: "#efe6d3",
    BRN: "#7a4b2a",
    SND: "#cfb98e",
    GRN: "#3a4a3d",
    CRU: "#efe6d3",
    BEI: "#c9b9a3",
    RED: "#b03a2e",
  };
  if (palette[code]) return palette[code];
  // Fallback — derive a CSS color from char codes for unknown variants.
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 40%, 55%)`;
}
