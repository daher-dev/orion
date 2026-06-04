"use client";

import Image from "next/image";
import { Shirt } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { Order } from "@/lib/schemas/order";
import { variantColor } from "@/lib/variant-color";

/**
 * Single variation card on the detail page — modelled on the design's
 * "Itens" block in `/docs/design/source/pages/sales.jsx` (line 360).
 *
 * Layout: 42x42 garment glyph thumb, variation name + color + size,
 * unit price and total on the right.
 */
type Props = {
  order: Order;
};

export function OrderLineItem({ order }: Props) {
  const t = useTranslations("orders.detail");
  const locale = useLocale();
  const format = useFormatter();
  void format;

  const currency = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: locale === "pt-BR" ? "BRL" : "USD",
  });

  const unit = order.sale_price != null ? Number(order.sale_price) : null;
  const total = unit != null ? unit * order.quantity : null;

  return (
    <div
      data-testid="order-line-item"
      className="flex items-center gap-3 py-2.5"
    >
      <span
        className="relative grid h-[42px] w-[42px] shrink-0 place-items-center overflow-hidden rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]"
        aria-hidden="true"
      >
        {order.variation.product.image_url ? (
          <Image
            src={order.variation.product.image_url}
            alt=""
            fill
            sizes="42px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <Shirt size={20} strokeWidth={1.4} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[color:var(--orion-ink)]">
          {order.variation.product.name}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-[color:var(--orion-ink-2)]">
          <span className="inline-flex items-center gap-1.5">
            {/* Design: 10×10 swatch using the variant's hex (mirrors `v.hex`
                in /docs/design/source/pages/sales.jsx line 377). */}
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-[color:var(--orion-line-soft)]"
              style={{
                background: variantColor(order.variation.color_code),
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.04)",
              }}
              aria-hidden="true"
            />
            <span>{order.variation.color}</span>
          </span>
          <span className="inline-block rounded-[3px] border border-[color:var(--orion-line-soft)] px-1 py-px font-mono text-[10px] leading-[1.2] text-[color:var(--orion-ink-3)]">
            {order.variation.size.toUpperCase()}
          </span>
          <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
            {order.variation.sku}
          </span>
          {unit != null && (
            <span className="text-[color:var(--orion-ink-3)]">
              · {currency.format(unit)} {t("unitPrice").toLowerCase()}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="text-[13px] text-[color:var(--orion-ink-3)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ×{order.quantity}
        </span>
        <span
          className="min-w-[80px] text-right text-[13px] font-medium text-[color:var(--orion-ink)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {total != null ? currency.format(total) : "—"}
        </span>
      </div>
    </div>
  );
}
