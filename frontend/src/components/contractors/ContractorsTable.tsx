"use client";

import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight, Factory } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Contractor } from "@/lib/schemas/contractor";

type Props = {
  data: Contractor[];
  onRowClick: (contractor: Contractor) => void;
};

export function ContractorsTable({ data, onRowClick }: Props) {
  const t = useTranslations("contractors.table.columns");
  const format = useFormatter();

  const columns = useMemo<ColumnDef<Contractor>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("name"),
        cell: (info) => (
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
              {info.getValue() as string}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "address",
        header: t("address"),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return value ?? <span className="text-[color:var(--orion-ink-3)]">—</span>;
        },
      },
      {
        accessorKey: "phone",
        header: t("phone"),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return value ? (
            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">{value}</span>
          ) : (
            <span className="text-[color:var(--orion-ink-3)]">—</span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: t("created"),
        cell: (info) => {
          const value = info.getValue() as string;
          if (!value) return null;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return null;
          return (
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {format.dateTime(date, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          );
        },
      },
      {
        id: "chevron",
        header: () => <span className="sr-only">{t("actions")}</span>,
        size: 36,
        cell: () => (
          <ChevronRight
            size={14}
            strokeWidth={1.8}
            style={{ color: "var(--orion-ink-3)" }}
          />
        ),
      },
    ],
    [format, t],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table
        data-testid="contractors-table"
        className="w-full border-collapse text-[13px]"
        style={{ borderSpacing: 0 }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left text-[10.5px] font-semibold uppercase"
                  style={{
                    padding: "10px 14px",
                    letterSpacing: "0.08em",
                    color: "var(--orion-ink-3)",
                    background: "var(--orion-bg)",
                    borderBottom: "1px solid var(--orion-line)",
                    width: header.id === "chevron" ? 36 : undefined,
                  }}
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
          {table.getRowModel().rows.map((row, index, rows) => (
            <tr
              key={row.id}
              data-testid="contractor-row"
              onClick={() => onRowClick(row.original)}
              className="cursor-pointer transition-colors hover:bg-[color:var(--orion-bg)]"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    padding: "12px 14px",
                    borderBottom:
                      index === rows.length - 1 ? "0" : "1px solid var(--orion-line-soft)",
                    color: "var(--orion-ink-2)",
                    verticalAlign: "middle",
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
