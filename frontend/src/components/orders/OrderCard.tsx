"use client";

import { GitMerge, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { OrderChannelChip } from "./OrderChannelChip";
import type { BoardStage, Order } from "@/lib/schemas/order";

/**
 * One order card on the Pedidos board (port of `separacao.jsx` `OrderCard`).
 *
 * Shows the item-ready progress bar (`on_hand`/`quantity` → ready/total), the
 * platform chip and the order age. A full-width footer action is rendered per
 * stage: Mapeamento → "Vincular", Separação → "Imprimir etiquetas".
 */
type Props = {
  order: Order;
  stage: BoardStage;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpen: (order: Order) => void;
  onVincular?: (order: Order) => void;
  onEtiquetas?: (order: Order) => void;
};

/** Order age in whole days from `ordered_at` (clamped at 0). */
function ageDays(orderedAt: string): number | null {
  const placed = new Date(orderedAt);
  if (Number.isNaN(placed.getTime())) return null;
  const ms = Date.now() - placed.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function OrderCard({
  order,
  stage,
  selected = false,
  onToggleSelect,
  onOpen,
  onVincular,
  onEtiquetas,
}: Props) {
  const t = useTranslations("orders.board.card");

  // The prototype counts ready *item lines*; on our one-variation order grain
  // this reduces to "how many of the ordered pieces are in finished stock".
  const total = order.quantity;
  const ready = Math.min(order.on_hand, total);
  const pct = total > 0 ? (ready / total) * 100 : 0;
  const full = ready >= total;

  const days = ageDays(order.ordered_at);
  const ageLabel =
    days == null ? "" : days === 0 ? t("today") : t("ageDays", { count: days });
  const old = days != null && days >= 5;

  const shortCode = order.external_order_id ?? order.id.slice(0, 8);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      data-testid={`order-card-${order.id}`}
      data-stage={stage}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(order);
      }}
      className="cursor-pointer overflow-hidden rounded-[8px] border bg-[color:var(--orion-bg)] transition-[border-color,box-shadow] duration-100"
      style={{
        borderColor: selected ? "var(--brand-sales)" : "var(--orion-line-soft)",
        boxShadow: selected ? "0 0 0 1px var(--brand-sales)" : "none",
      }}
    >
      <div className="p-[9px_10px]">
        {/* line 1: items ready / total + short code */}
        <div className="flex items-center gap-[7px]">
          {stage === "separacao" && onToggleSelect ? (
            <input
              type="checkbox"
              checked={selected}
              onClick={stop}
              onChange={() => onToggleSelect(order.id)}
              aria-label={shortCode}
              data-testid={`order-card-select-${order.id}`}
              className="h-[15px] w-[15px] flex-shrink-0 cursor-pointer accent-[color:var(--brand-sales)]"
            />
          ) : null}
          <span className="whitespace-nowrap text-[11.5px] text-[color:var(--orion-ink-3)]">
            <span
              className="font-serif text-[13px]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <b
                className="font-semibold"
                style={{ color: full ? "var(--status-ok)" : "var(--orion-ink)" }}
              >
                {ready}
              </b>
              /{total}
            </span>{" "}
            {t("itemsLabel", { count: total })}
          </span>
          <span className="ml-auto flex-shrink-0 whitespace-nowrap font-mono text-[11px] text-[color:var(--orion-ink-2)]">
            {shortCode}
          </span>
        </div>

        {/* line 2: progress bar */}
        <div className="mt-[7px] h-[5px] overflow-hidden rounded-full bg-[color:var(--orion-line-soft)]">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${pct}%`,
              background: full ? "var(--status-ok)" : "var(--brand-prod)",
            }}
          />
        </div>

        {/* line 3: platform · age */}
        <div className="mt-2 flex items-center gap-2">
          <OrderChannelChip channel={order.ad.ecommerce} />
          <span
            className="ml-auto whitespace-nowrap text-[11px]"
            style={{
              color: old ? "var(--status-warn)" : "var(--orion-ink-3)",
              fontWeight: old ? 600 : 400,
            }}
          >
            {ageLabel}
          </span>
        </div>
      </div>

      {/* footer action — full width, stage-specific */}
      {stage === "mapeamento" && onVincular ? (
        <FooterButton
          testId={`order-card-vincular-${order.id}`}
          onClick={(e) => {
            stop(e);
            onVincular(order);
          }}
        >
          <GitMerge size={13} /> {t("vincular")}
        </FooterButton>
      ) : null}
      {stage === "separacao" && onEtiquetas ? (
        <FooterButton
          testId={`order-card-etiquetas-${order.id}`}
          onClick={(e) => {
            stop(e);
            onEtiquetas(order);
          }}
        >
          <Tag size={13} /> {t("printLabels")}
        </FooterButton>
      ) : null}
    </div>
  );
}

function FooterButton({
  children,
  onClick,
  testId,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-2 py-[7px] text-[12px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
    >
      {children}
    </button>
  );
}
