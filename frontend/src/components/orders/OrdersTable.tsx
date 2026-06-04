"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronRight, Shirt } from "lucide-react";
import Image from "next/image";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Checkbox } from "@/components/ui/checkbox";
import type { Order } from "@/lib/schemas/order";
import { variantColor } from "@/lib/variant-color";
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
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
      // code — design: just text (the surrounding row handles the click).
      {
        id: "code",
        header: () => t("table.columns.code"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
              {shortOrderCode(row.original.id)}
            </span>
            {row.original.external_order_id ? (
              <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                {row.original.external_order_id}
              </span>
            ) : null}
          </div>
        ),
      },
      // client (before channel — QA-013)
      {
        id: "client",
        header: () => t("table.columns.client"),
        cell: ({ row }) => (
          <span className="text-[13px] text-[color:var(--orion-ink)]">
            {row.original.client?.name ?? "—"}
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
                {/* Design: real color hex from `parseVariant`, sized 9×9 with a
                    1px soft outline. Falls back to a hashed HSL for unknown codes. */}
                <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--orion-ink-3)]">
                  <span
                    className="inline-block h-[9px] w-[9px] shrink-0 rounded-full border border-[color:var(--orion-line-soft)]"
                    style={{ background: variantColor(v.color_code) }}
                    aria-hidden="true"
                  />
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
          const price = row.original.sale_price;
          if (price == null) {
            return <span className="text-[13px] text-[color:var(--orion-ink-3)]">—</span>;
          }
          const total = Number(price) * row.original.quantity;
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
      // Row-end chevron — the entire row is the click target; delete and
      // any other row operations live on the detail drawer that opens.
      {
        id: "chevron",
        header: () => null,
        cell: () => (
          <div className="flex items-center justify-end">
            <ChevronRight
              aria-hidden
              size={14}
              strokeWidth={1.8}
              className="text-[color:var(--orion-ink-3)]"
            />
          </div>
        ),
      },
    ];

    return base;
  }, [currency, format, t]);

  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  const table = useReactTable({
    data: rows,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

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
              // Design: full-row click opens the detail sheet — mirrors
              // `<tr onClick={() => setOpen(o)}>` in sales.jsx line 94.
              // The checkbox + actions cells stop propagation so they keep
              // their own behaviour.
              <tr
                key={row.id}
                data-testid={`order-row-${row.original.id}`}
                onClick={() =>
                  onView
                    ? onView(row.original)
                    : router.push(`/orders/${row.original.id}`)
                }
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
    </>
  );
}
