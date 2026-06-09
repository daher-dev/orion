"use client";

import Image from "next/image";
import { Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PrintQueueItem } from "@/lib/schemas/batch";

type Props = {
  rows: PrintQueueItem[];
};

const TH =
  "border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] py-[10px] px-[14px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

function designLabel(row: PrintQueueItem): string {
  return (
    row.design?.code ??
    row.design?.name ??
    row.print_design_id?.slice(0, 8) ??
    "—"
  );
}

export function PrintQueueTable({ rows }: Props) {
  const t = useTranslations("batches.printQueue");

  if (rows.length === 0) {
    return (
      <div
        data-testid="print-queue-empty"
        className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center"
      >
        <Layers
          aria-hidden
          size={28}
          strokeWidth={1.6}
          className="text-[color:var(--orion-ink-3)]"
        />
        <p className="text-[13px] font-medium text-[color:var(--orion-ink-2)]">
          {t("emptyTitle")}
        </p>
        <p className="text-[12px] text-[color:var(--orion-ink-3)]">
          {t("emptyDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={TH}>{t("design")}</th>
            <th className={TH}>{t("color")}</th>
            <th className={`${TH} text-right`}>{t("needed")}</th>
            <th className={`${TH} text-right`}>{t("onHand")}</th>
            <th className={`${TH} text-right`}>{t("toPrint")}</th>
            <th className={`${TH} text-right`}>{t("batches")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx, arr) => {
            const border =
              idx < arr.length - 1
                ? "border-b border-[color:var(--orion-line-soft)]"
                : "";
            const key = `${row.print_design_id ?? "none"}-${row.product_color}`;
            return (
              <tr key={key} data-testid={`print-queue-row-${key}`}>
                <td className={`px-[14px] py-[12px] align-middle ${border}`}>
                  <div className="flex items-center gap-3">
                    {row.design?.image_url ? (
                      <Image
                        src={row.design.image_url}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 rounded-[6px] border border-[color:var(--orion-line-soft)] object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)]">
                        <Layers
                          aria-hidden
                          size={15}
                          strokeWidth={1.6}
                          className="text-[color:var(--orion-ink-3)]"
                        />
                      </div>
                    )}
                    <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
                      {designLabel(row)}
                    </span>
                  </div>
                </td>
                <td className={`px-[14px] py-[12px] align-middle ${border}`}>
                  <span className="text-[13px] text-[color:var(--orion-ink-2)]">
                    {row.product_color}
                  </span>
                </td>
                <td
                  className={`px-[14px] py-[12px] text-right align-middle ${border}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.qty_needed}
                </td>
                <td
                  className={`px-[14px] py-[12px] text-right align-middle text-[color:var(--orion-ink-3)] ${border}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.qty_stock}
                </td>
                <td
                  className={`px-[14px] py-[12px] text-right align-middle font-semibold text-[color:var(--brand-sales)] ${border}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.qty_to_print}
                </td>
                <td
                  className={`px-[14px] py-[12px] text-right align-middle text-[color:var(--orion-ink-3)] ${border}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.batch_count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
