"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrderChannelChip } from "@/components/orders/OrderChannelChip";
import { EstampaTag } from "./EstampaTag";
import {
  useAcceptSuggestion,
  useMappingItems,
  useSetVariation,
} from "@/hooks/use-mapping";
import { useProducts } from "@/hooks/use-products";
import { ApiError } from "@/lib/api-client";
import { shortOrderCode } from "@/components/orders/OrdersTable";
import type { Order } from "@/lib/schemas/order";
import type { MappingItem } from "@/lib/schemas/mapping";

const SHEET_CLASS =
  "flex h-full w-[560px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

/**
 * Per-order De/Para sheet (port of `separacao.jsx` `VincularSheet`).
 *
 * Lists the order's pieces still awaiting mapping (the pending `OrderItem`s
 * surfaced by `/v1/mapping/items`) and, per item, lets the operator accept the
 * system suggestion ("Usar") or pick an internal variation (product → SKU).
 * Each confirm POSTs `/v1/mapping/items/{id}/variation`; once every piece is
 * linked the order leaves the Mapeamento column (the hooks invalidate orders).
 */
type Props = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VincularSheet({ order, open, onOpenChange }: Props) {
  const t = useTranslations("vincular");

  // Pull the pending mapping items and narrow to this order. The list is
  // tenant-scoped + paginated; one page covers an order's handful of pieces.
  const { data, isPending, isError } = useMappingItems(
    open ? { filter: "pending", page_size: 100 } : undefined,
  );
  const items = useMemo(
    () => (data?.items ?? []).filter((m) => m.order_id === order?.id),
    [data, order?.id],
  );

  const linkedCount = items.filter((m) => m.linked).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={SHEET_CLASS} side="right">
        <SheetHeader
          className="border-b border-[color:var(--orion-line-soft)]"
          style={{ padding: "18px 22px" }}
        >
          <SheetTitle className="flex items-center gap-2 font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            <span className="font-mono">
              {order ? shortOrderCode(order.id) : t("title")}
            </span>
            {order ? <OrderChannelChip channel={order.ad.ecommerce} /> : null}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
            {t("subtitle", { picked: linkedCount, total: items.length })}
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ padding: "18px 22px" }}
        >
          {isPending ? (
            <div className="grid gap-3">
              <Skeleton className="h-[110px] rounded-[10px]" />
              <Skeleton className="h-[110px] rounded-[10px]" />
            </div>
          ) : isError ? (
            <p className="text-center text-[13px] text-[color:var(--status-err)]">
              {t("loadError")}
            </p>
          ) : items.length === 0 ? (
            <p className="text-center text-[13px] text-[color:var(--orion-ink-3)]">
              {t("empty")}
            </p>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <VincularItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function VincularItemRow({ item }: { item: MappingItem }) {
  const t = useTranslations("vincular");
  const accept = useAcceptSuggestion();
  const setVariation = useSetVariation();
  const pending = accept.isPending || setVariation.isPending;

  const [productId, setProductId] = useState<string>("");
  // Catalog only loads once the manual picker is in use.
  const { data: productsPage } = useProducts(
    productId || !item.suggestion ? { page_size: 100 } : undefined,
  );
  const products = useMemo(() => productsPage?.items ?? [], [productsPage]);
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const linked = item.linked;

  const onAccept = async () => {
    try {
      await accept.mutateAsync(item.id);
      toast.success(t("toast.itemLinked", { sku: item.suggestion?.sku ?? "" }));
    } catch (err) {
      toast.error(err instanceof ApiError && err.detail ? err.detail : t("toast.error"));
    }
  };

  const onPick = async (variationId: string) => {
    try {
      const res = await setVariation.mutateAsync({
        itemId: item.id,
        payload: { variation_id: variationId },
      });
      toast.success(t("toast.itemLinked", { sku: res.sku ?? "" }));
    } catch (err) {
      toast.error(err instanceof ApiError && err.detail ? err.detail : t("toast.error"));
    }
  };

  return (
    <div
      data-testid={`vincular-item-${item.id}`}
      className="rounded-[10px] border p-3"
      style={{
        background: "var(--orion-surface)",
        borderColor: linked
          ? "color-mix(in oklab, var(--status-ok) 30%, var(--orion-surface))"
          : "var(--orion-line)",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-[color:var(--orion-ink)]">
            {item.ad_title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {item.variation_text ? (
              <span className="rounded-[6px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[11.5px] text-[color:var(--orion-ink-2)]">
                {item.variation_text}
              </span>
            ) : null}
            {item.ad_sku ? (
              <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                {item.ad_sku}
              </span>
            ) : null}
          </div>
        </div>
        {linked ? (
          <CheckCircle2
            size={18}
            className="flex-shrink-0 text-[color:var(--status-ok)]"
          />
        ) : (
          <span
            className="flex-shrink-0 rounded-full border px-2 py-[2px] text-[10.5px] font-semibold"
            style={{
              color: "var(--status-warn)",
              background: "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
              borderColor: "color-mix(in oklab, var(--status-warn) 24%, var(--orion-surface))",
            }}
          >
            {t("toLink")}
          </span>
        )}
      </div>

      {linked ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <span
            className="rounded-[5px] px-[7px] py-[2px] font-mono text-[11px] text-[color:var(--brand-sales)]"
            style={{ background: "color-mix(in oklab, var(--brand-sales) 10%, var(--orion-surface))" }}
          >
            {item.sku ?? "—"}
          </span>
          {item.product_name ? (
            <span className="text-[12px] text-[color:var(--orion-ink-2)]">
              {item.product_name}
            </span>
          ) : null}
          <EstampaTag code={item.print_design_code} name={item.print_design_name} />
        </div>
      ) : (
        <div className="mt-2.5">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[color:var(--orion-ink-3)]">
            {t("skuLabel")}
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={productId}
                onValueChange={(v) => setProductId(v)}
                disabled={pending}
              >
                <SelectTrigger
                  data-testid={`vincular-product-${item.id}`}
                  className="h-auto w-full rounded-[8px] border-[color:var(--orion-line)] py-2 text-[13px]"
                >
                  <SelectValue placeholder={t("chooseProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ChevronRight
              size={14}
              className="flex-shrink-0 text-[color:var(--orion-ink-3)]"
            />
            <div className="min-w-0 flex-1">
              {selectedProduct ? (
                <Select onValueChange={onPick} disabled={pending}>
                  <SelectTrigger
                    data-testid={`vincular-variation-${item.id}`}
                    className="h-auto w-full rounded-[8px] border-[color:var(--orion-line)] py-2 text-[13px]"
                  >
                    <SelectValue placeholder={t("chooseVariation")} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct.variations.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.color} · {v.size.toUpperCase()} — {v.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="overflow-hidden text-ellipsis whitespace-nowrap rounded-[8px] border border-dashed border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] px-[11px] py-2 text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("pickProductFirst")}
                </div>
              )}
            </div>
          </div>

          {item.suggestion ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-[color:var(--orion-ink-3)]">
              <Sparkles
                size={12}
                className="flex-shrink-0 text-[color:var(--brand-sales)]"
              />
              <span className="min-w-0">
                {t("suggestion")}:{" "}
                <b className="font-medium text-[color:var(--orion-ink-2)]">
                  {item.suggestion.product_name} · {item.suggestion.sku}
                </b>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onAccept}
                disabled={pending}
                data-testid={`vincular-use-${item.id}`}
                className="ml-auto h-auto gap-1 rounded-[6px] border px-2.5 py-1 text-[12px] text-[color:var(--brand-sales)]"
                style={{
                  background: "color-mix(in oklab, var(--brand-sales) 8%, var(--orion-surface))",
                  borderColor: "color-mix(in oklab, var(--brand-sales) 30%, var(--orion-surface))",
                }}
              >
                <Check size={13} /> {t("use")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
