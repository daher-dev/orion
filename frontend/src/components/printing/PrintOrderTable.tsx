"use client";

import { useTranslations } from "next-intl";
import { TransferChip } from "@/components/inventory/TransferChip";
import { PrintOrderStatusPill } from "./PrintOrderStatusPill";
import type { PrintOrder } from "@/lib/schemas/print-order";

type Props = {
  rows: PrintOrder[];
  onView: (order: PrintOrder) => void;
};

export function PrintOrderTable({ rows, onView }: Props) {
  const t = useTranslations("printOrders");

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-[color:var(--orion-line-soft)] text-left text-[11px] uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
          <th className="px-4 py-2.5 font-semibold">{t("table.code")}</th>
          <th className="px-4 py-2.5 font-semibold">{t("table.estampa")}</th>
          <th className="px-4 py-2.5 font-semibold">{t("table.technique")}</th>
          <th className="px-4 py-2.5 font-semibold">{t("table.roll")}</th>
          <th className="px-4 py-2.5 font-semibold">{t("table.status")}</th>
          <th className="px-4 py-2.5 text-right font-semibold">{t("table.planned")}</th>
          <th className="px-4 py-2.5 text-right font-semibold">{t("table.printed")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr
            key={c.id}
            onClick={() => onView(c)}
            className="cursor-pointer border-b border-[color:var(--orion-line-soft)] last:border-0 hover:bg-[color:var(--orion-surface-2)]"
          >
            <td className="px-4 py-2.5 font-mono text-[12px] text-[color:var(--orion-ink-2)]">{c.code}</td>
            <td className="px-4 py-2.5 font-medium text-[color:var(--orion-ink)]">
              <span className="flex items-center gap-2.5">
                <TransferChip imageUrl={c.design.image_url} size={24} />
                {c.design.name}
              </span>
            </td>
            <td className="px-4 py-2.5">
              <span className="inline-flex items-center rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-1.5 py-px text-[10.5px] uppercase text-[color:var(--orion-ink-3)]">
                {t(`techniques.${c.design.technique}`)}
              </span>
            </td>
            <td className="px-4 py-2.5 font-mono text-[12px] text-[color:var(--orion-ink-2)]">
              {c.paper_roll?.code ?? "—"}
            </td>
            <td className="px-4 py-2.5">
              <PrintOrderStatusPill status={c.status} />
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{c.total_planned}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{c.total_printed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
