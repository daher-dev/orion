"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight, Factory, PackageCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCanAccess } from "@/hooks/use-permissions";
import { sumReceived, sumRequested, type Shipment } from "@/lib/schemas/sewing";
import { ShipmentStatusPill } from "./ShipmentStatusPill";
import { ShipmentReceiveDialog } from "./ShipmentReceiveDialog";

type Props = {
  rows: Shipment[];
  onView: (shipment: Shipment) => void;
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function ShipmentTable({ rows, onView }: Props) {
  const t = useTranslations("sewing");
  const format = useFormatter();
  const canWrite = useCanAccess("sewing.write");
  const [receiving, setReceiving] = useState<Shipment | null>(null);

  const columns = useMemo<ColumnDef<Shipment>[]>(() => {
    const base: ColumnDef<Shipment>[] = [
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
        id: "contractor",
        header: () => t("table.columns.contractor"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-[6px]"
              style={{
                background: "var(--orion-surface-2)",
                color: "var(--brand-prod)",
              }}
            >
              <Factory size={13} strokeWidth={1.6} />
            </span>
            <span className="font-medium text-[color:var(--orion-ink)]">
              {row.original.contractor.name}
            </span>
          </div>
        ),
      },
      {
        id: "cutting_order",
        header: () => t("table.columns.cuttingOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
            {row.original.cutting_order?.code ?? "—"}
          </span>
        ),
      },
      {
        id: "sent_at",
        header: () => t("table.columns.sentAt"),
        cell: ({ row }) => {
          const date = new Date(row.original.sent_at);
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
      {
        id: "received_at",
        header: () => t("table.columns.receivedAt"),
        cell: ({ row }) => {
          const value = row.original.received_at;
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
      {
        id: "status",
        header: () => t("table.columns.status"),
        cell: ({ row }) => <ShipmentStatusPill status={row.original.status} />,
      },
      {
        id: "totals",
        header: () => t("table.columns.totals"),
        cell: ({ row }) => {
          const requested = sumRequested(row.original.items);
          const received = sumReceived(row.original.items);
          return (
            <span
              className="text-[13px] text-[color:var(--orion-ink-2)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {received}
              <span className="text-[color:var(--orion-ink-3)]"> / {requested}</span>
            </span>
          );
        },
      },
    ];

    if (canWrite) {
      base.push({
        id: "actions",
        header: () => <span className="sr-only">{t("table.columns.actions")}</span>,
        cell: ({ row }) => {
          const canReceive =
            row.original.status === "sent" || row.original.status === "partial";
          return (
            <div className="flex items-center justify-end gap-1">
              {canReceive ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReceiving(row.original);
                  }}
                  className="h-7 gap-1 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-2 text-[11.5px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
                >
                  <PackageCheck size={11} strokeWidth={1.8} />
                  {t("actions.receive")}
                </Button>
              ) : null}
            </div>
          );
        },
      });
    }

    base.push({
      id: "chevron",
      header: () => <span className="sr-only">{t("actions.view")}</span>,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("actions.view")}
          onClick={(e) => {
            e.stopPropagation();
            onView(row.original);
          }}
          className="h-7 w-7 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)]"
        >
          <ChevronRight size={14} strokeWidth={1.8} />
        </Button>
      ),
    });

    return base;
  }, [canWrite, format, onView, t]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)] ${
                      header.column.id === "actions" || header.column.id === "chevron" ? "text-right" : ""
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
                className="cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
                onClick={() => onView(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                      idx < arr.length - 1
                        ? "border-b border-[color:var(--orion-line-soft)]"
                        : ""
                    } ${cell.column.id === "actions" || cell.column.id === "chevron" ? "text-right" : ""}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ShipmentReceiveDialog
        open={receiving !== null}
        shipment={receiving}
        onOpenChange={(open) => {
          if (!open) setReceiving(null);
        }}
      />
    </>
  );
}
