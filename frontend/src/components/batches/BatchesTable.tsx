"use client";

import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { BatchListItem } from "@/lib/schemas/batch";
import { BatchStatusPill } from "./BatchStatusPill";

type Props = {
  rows: BatchListItem[];
};

const TH =
  "border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] py-[10px] px-[14px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

export function BatchesTable({ rows }: Props) {
  const t = useTranslations("batches.columns");
  const format = useFormatter();
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={TH}>{t("code")}</th>
            <th className={TH}>{t("name")}</th>
            <th className={TH}>{t("status")}</th>
            <th className={`${TH} text-right`}>{t("orders")}</th>
            <th className={`${TH} text-right`}>{t("pieces")}</th>
            <th className={TH}>{t("created")}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx, arr) => {
            const created = new Date(row.created_at);
            const border =
              idx < arr.length - 1
                ? "border-b border-[color:var(--orion-line-soft)]"
                : "";
            return (
              <tr
                key={row.id}
                data-testid={`batch-row-${row.id}`}
                onClick={() => router.push(`/orders/batches/${row.id}`)}
                className="cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
              >
                <td className={`px-[14px] py-[12px] align-middle ${border}`}>
                  <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
                    {row.code}
                  </span>
                </td>
                <td className={`px-[14px] py-[12px] align-middle ${border}`}>
                  <span className="text-[13px] text-[color:var(--orion-ink-2)]">
                    {row.name ?? "—"}
                  </span>
                </td>
                <td className={`px-[14px] py-[12px] align-middle ${border}`}>
                  <BatchStatusPill status={row.status} />
                </td>
                <td
                  className={`px-[14px] py-[12px] text-right align-middle ${border}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.total_orders}
                </td>
                <td
                  className={`px-[14px] py-[12px] text-right align-middle ${border}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.total_pieces}
                </td>
                <td className={`px-[14px] py-[12px] align-middle ${border}`}>
                  <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                    {Number.isNaN(created.getTime())
                      ? "—"
                      : format.dateTime(created, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                  </span>
                </td>
                <td className={`px-[14px] py-[12px] text-right align-middle ${border}`}>
                  <ChevronRight
                    aria-hidden
                    size={14}
                    strokeWidth={1.8}
                    className="text-[color:var(--orion-ink-3)]"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
