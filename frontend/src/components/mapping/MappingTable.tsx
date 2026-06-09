"use client";

import { BookMarked, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { OrderChannelChip } from "@/components/orders/OrderChannelChip";
import type { MappingFilter, MappingItem } from "@/lib/schemas/mapping";
import { MappingSuggestionCell } from "./MappingSuggestionCell";

type Props = {
  rows: MappingItem[];
  filter: MappingFilter;
  /** Accept the system suggestion for one row. */
  onAccept: (itemId: string) => void;
  /** Manually set a variation id for one row (the "Trocar" path). */
  onSetVariation: (itemId: string, variationId: string) => void;
  /** Id of the row whose accept/swap mutation is in flight. */
  pendingItemId?: string | null;
};

const TH =
  "border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] py-[10px] px-[14px] text-left text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]";

function StatusPill({ linked }: { linked: boolean }) {
  const t = useTranslations("mapping");
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] font-medium"
      style={
        linked
          ? {
              color: "var(--status-ok)",
              background: "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))",
              borderColor: "color-mix(in oklab, var(--status-ok) 22%, var(--orion-surface))",
            }
          : {
              color: "var(--status-warn)",
              background: "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
              borderColor: "color-mix(in oklab, var(--status-warn) 22%, var(--orion-surface))",
            }
      }
    >
      {linked ? t("status.linked") : t("status.pending")}
    </span>
  );
}

export function MappingTable({
  rows,
  filter,
  onAccept,
  onSetVariation,
  pendingItemId,
}: Props) {
  const t = useTranslations("mapping");

  if (rows.length === 0) {
    const isPending = filter === "pending";
    return (
      <div
        data-testid="mapping-empty"
        className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
      >
        {isPending ? (
          <CheckCircle2 size={28} className="text-[color:var(--orion-ink-3)]" />
        ) : (
          <BookMarked size={28} className="text-[color:var(--orion-ink-3)]" />
        )}
        <p className="text-[14px] font-medium text-[color:var(--orion-ink)]">
          {isPending ? t("empty.pending.title") : t("empty.other.title")}
        </p>
        <p className="max-w-[42ch] text-[13px] text-[color:var(--orion-ink-3)]">
          {isPending ? t("empty.pending.desc") : t("empty.other.desc")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className={TH}>
              {t("columns.orderItem")}{" "}
              <span className="font-normal text-[color:var(--orion-ink-3)]">
                {t("columns.orderItemSub")}
              </span>
            </th>
            <th className={TH}>{t("columns.adVariation")}</th>
            <th className={`${TH} w-[380px]`}>{t("columns.internalSku")}</th>
            <th className={`${TH} w-[120px]`}>{t("columns.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx, arr) => {
            const border =
              idx < arr.length - 1
                ? "border-b border-[color:var(--orion-line-soft)]"
                : "";
            return (
              <tr
                key={row.id}
                data-testid={`mapping-row-${row.id}`}
                className="align-top"
              >
                <td className={`px-[14px] pt-[14px] pb-3 ${border}`}>
                  <div className="max-w-[320px] font-medium text-[color:var(--orion-ink)]">
                    {row.ad_title}
                  </div>
                  <div className="mt-1 flex items-center gap-[7px]">
                    <OrderChannelChip channel={row.channel} />
                    {row.ad_sku ? (
                      <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                        {row.ad_sku}
                      </span>
                    ) : (
                      <span className="text-[11px] italic text-[color:var(--status-warn)]">
                        {t("row.noAdSku")}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`px-[14px] pt-[14px] pb-3 ${border}`}>
                  {row.variation_text ? (
                    <span className="inline-flex items-center whitespace-nowrap rounded-[6px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-[9px] py-[3px] text-[12px] text-[color:var(--orion-ink-2)]">
                      {row.variation_text}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[color:var(--orion-ink-3)]">—</span>
                  )}
                </td>
                <td className={`px-[14px] py-3 ${border}`}>
                  <MappingSuggestionCell
                    item={row}
                    onAccept={() => onAccept(row.id)}
                    onSetVariation={(variationId) => onSetVariation(row.id, variationId)}
                    pending={pendingItemId === row.id}
                  />
                </td>
                <td className={`px-[14px] pt-[14px] pb-3 ${border}`}>
                  <StatusPill linked={row.linked} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
