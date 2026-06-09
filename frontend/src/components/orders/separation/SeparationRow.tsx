"use client";

import { CheckCircle2, ChevronRight, Loader2, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { OrderChannelChip } from "@/components/orders/OrderChannelChip";
import { shortOrderCode } from "@/components/orders/OrdersTable";
import { useOrderItems } from "@/hooks/use-separation";
import type { Order } from "@/lib/schemas/order";
import type { OrderItem, SeparationStatus } from "@/lib/schemas/separation";

/**
 * One order row in the Separação list — port of the design's per-order row in
 * `/docs/design/pages/separacao.jsx`. Shows the order code, channel chip,
 * piece count, a separation-status pill and an "Etiquetas" action. Expanding
 * the row fetches the per-piece items lazily (avoids the N+1 on the whole list)
 * and renders one line per physical piece with its check status.
 */
type Props = {
  order: Order;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onEtiquetas: () => void;
};

type RowStatus = SeparationStatus | "mixed";

/** Aggregate per-piece statuses into one row-level status. */
function aggregateStatus(items: OrderItem[]): RowStatus | null {
  if (items.length === 0) return null;
  const distinct = new Set(items.map((i) => i.status));
  if (distinct.size === 1) return [...distinct][0];
  if ([...distinct].every((s) => s === "checked" || s === "label_printed")) {
    return "label_printed";
  }
  return "mixed";
}

function StatusPill({ status }: { status: RowStatus }) {
  const t = useTranslations("separation.status");
  const tone: Record<RowStatus, { color: string; bg: string; border: string }> = {
    pending: {
      color: "var(--status-warn)",
      bg: "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
      border: "color-mix(in oklab, var(--status-warn) 25%, var(--orion-surface))",
    },
    label_printed: {
      color: "var(--status-info)",
      bg: "color-mix(in oklab, var(--status-info) 14%, var(--orion-surface))",
      border: "color-mix(in oklab, var(--status-info) 25%, var(--orion-surface))",
    },
    checked: {
      color: "var(--status-ok)",
      bg: "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))",
      border: "color-mix(in oklab, var(--status-ok) 25%, var(--orion-surface))",
    },
    mixed: {
      color: "var(--orion-ink-3)",
      bg: "var(--orion-surface-2)",
      border: "var(--orion-line-soft)",
    },
  };
  const s = tone[status];
  return (
    <span
      data-testid={`separation-status-${status}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5]"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {t(status)}
    </span>
  );
}

export function SeparationRow({
  order,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onEtiquetas,
}: Props) {
  const t = useTranslations("separation.row");
  const { data: items, isPending } = useOrderItems(expanded ? order.id : null);

  const pieces = items?.length ?? order.quantity;
  const checked = items?.filter((i) => i.status === "checked").length ?? 0;
  const rowStatus = items ? aggregateStatus(items) : null;

  return (
    <div
      className="border-b border-[color:var(--orion-line-soft)] transition-colors last:border-b-0"
      style={{ background: selected ? "var(--orion-surface-2)" : "transparent" }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={t("select", { code: shortOrderCode(order.id) })}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? t("collapse") : t("expand")}
          aria-expanded={expanded}
          className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-[5px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)]"
        >
          <ChevronRight
            size={15}
            className="transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          />
        </button>
        <span className="flex-shrink-0 font-mono text-[14.5px] font-semibold text-[color:var(--orion-ink)]">
          {order.external_order_id ?? shortOrderCode(order.id)}
        </span>
        <OrderChannelChip channel={order.ad.ecommerce} />
        <span className="whitespace-nowrap text-[12.5px] text-[color:var(--orion-ink-3)]">
          {t("pieces", { count: pieces })}
        </span>
        <span className="ml-auto flex flex-shrink-0 items-center gap-3">
          {rowStatus ? <StatusPill status={rowStatus} /> : null}
          <button
            type="button"
            onClick={onEtiquetas}
            className="inline-flex items-center gap-1.5 rounded-[7px] border px-[11px] py-[5px] text-[12.5px] font-medium"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-sales) 25%, var(--orion-surface))",
              background: "color-mix(in oklab, var(--brand-sales) 8%, var(--orion-surface))",
              color: "var(--brand-sales)",
            }}
          >
            <Tag size={13} />
            {t("etiquetas")}
          </button>
        </span>
      </div>

      {expanded ? (
        <div className="grid gap-2 px-4 pb-3.5 pl-[62px]">
          {isPending ? (
            <div className="flex items-center gap-2 py-2 text-[12.5px] text-[color:var(--orion-ink-3)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("loading")}
            </div>
          ) : !items || items.length === 0 ? (
            <p className="py-2 text-[12.5px] text-[color:var(--orion-ink-3)]">
              {t("noPieces")}
            </p>
          ) : (
            <>
              <div className="text-[11.5px] text-[color:var(--orion-ink-3)]">
                {t("checkedProgress", { checked, total: items.length })}
              </div>
              {items.map((item) => (
                <PieceLine key={item.id} item={item} order={order} />
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PieceLine({ item, order }: { item: OrderItem; order: Order }) {
  const isChecked = item.status === "checked";
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-3 py-2">
      <span
        className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full"
        style={{
          background: isChecked
            ? "color-mix(in oklab, var(--status-ok) 16%, var(--orion-surface))"
            : "var(--orion-surface-2)",
          color: isChecked ? "var(--status-ok)" : "var(--orion-ink-3)",
        }}
        aria-hidden="true"
      >
        {isChecked ? <CheckCircle2 size={13} /> : null}
      </span>
      <span className="flex-1 truncate text-[12.5px] text-[color:var(--orion-ink-2)]">
        {order.variation.product.name} · {order.variation.color}{" "}
        {order.variation.size.toUpperCase()}
      </span>
      <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
        {item.tracking_code ?? "—"}
      </span>
      <span className="font-mono text-[11.5px] text-[color:var(--orion-ink-3)]">
        {item.item_index}/{item.total_items}
      </span>
    </div>
  );
}
