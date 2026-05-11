"use client";

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { OrderChannelChip } from "./OrderChannelChip";
import { OrderStatusPill } from "./OrderStatusPill";
import { shortOrderCode } from "./OrdersTable";
import type { Order } from "@/lib/schemas/order";

type Props = {
  order: Order;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function OrderDetailHeader({ order, canWrite, onEdit, onDelete }: Props) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const placedOn = new Date(order.ordered_at);
  const placedDate = !Number.isNaN(placedOn.getTime())
    ? format.dateTime(placedOn, { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  return (
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--brand-sales)] hover:underline"
        >
          <ArrowLeft size={11} strokeWidth={2.2} />
          {t("actions.back")}
        </Link>
        <h1 className="flex items-center gap-2.5 font-serif text-[26px] font-normal leading-[1.05] tracking-[-0.025em] text-[color:var(--orion-ink)]">
          <span>{shortOrderCode(order.id)}</span>
          <OrderStatusPill status={order.status} />
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
          <OrderChannelChip channel={order.ad.ecommerce} />
          <span aria-hidden="true">·</span>
          {placedDate ? <span>{t("detail.placedOn", { date: placedDate })}</span> : null}
        </div>
      </div>
      {canWrite ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onEdit}
            className="h-auto gap-[6px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[12px] py-[7px] text-[13px] text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            <Pencil size={13} strokeWidth={1.8} />
            {t("actions.edit")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="h-auto gap-[6px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[12px] py-[7px] text-[13px] text-[color:var(--status-err)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            <Trash2 size={13} strokeWidth={1.8} />
            {t("actions.delete")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
