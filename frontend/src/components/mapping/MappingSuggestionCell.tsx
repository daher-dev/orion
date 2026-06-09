"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/hooks/use-products";
import type { MappingItem } from "@/lib/schemas/mapping";
import { EstampaTag } from "./EstampaTag";

type Props = {
  item: MappingItem;
  /** Accept the system suggestion for this row. */
  onAccept: () => void;
  /** Manually set a concrete variation id (the "Trocar" path). */
  onSetVariation: (variationId: string) => void;
  /** True while an accept/swap mutation for this row is in flight. */
  pending?: boolean;
};

/**
 * The "Produto → Variação (SKU interno)" cell from
 * `docs/design/pages/lotes.jsx` MapeamentoTab.
 *
 * - Linked rows render the resolved SKU + estampa tag.
 * - Pending rows with a suggestion render the sparkles suggestion card with
 *   Aceitar / Trocar. "Trocar" flips the row into manual mode: a product
 *   picker → a variation (SKU) picker.
 * - Pending rows without a suggestion go straight to manual mode.
 */
export function MappingSuggestionCell({
  item,
  onAccept,
  onSetVariation,
  pending,
}: Props) {
  const t = useTranslations("mapping");
  const [manual, setManual] = useState(false);
  const [productId, setProductId] = useState<string>("");

  // Catalog is only needed once the user opts into the manual picker.
  const { data: productsPage } = useProducts(manual ? { page_size: 100 } : undefined);
  const products = useMemo(() => productsPage?.items ?? [], [productsPage]);
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  if (item.linked) {
    return (
      <div
        className="flex flex-wrap items-center gap-2.5"
        data-testid={`mapping-linked-${item.id}`}
      >
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
    );
  }

  const suggestion = item.suggestion ?? null;

  if (suggestion && !manual) {
    return (
      <div
        data-testid={`mapping-suggestion-${item.id}`}
        className="flex items-center gap-3 rounded-[8px] border p-[9px_12px]"
        style={{
          background: "color-mix(in oklab, var(--brand-sales) 8%, var(--orion-surface))",
          borderColor: "color-mix(in oklab, var(--brand-sales) 26%, var(--orion-surface))",
        }}
      >
        <Sparkles
          size={15}
          className="shrink-0 text-[color:var(--brand-sales)]"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[color:var(--brand-sales)]">
            {t("suggestion.label")}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
              {suggestion.product_name}
            </span>
            <span
              className="rounded-[5px] border bg-[color:var(--orion-surface)] px-[7px] py-[2px] font-mono text-[11px] text-[color:var(--brand-sales)]"
              style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 20%, var(--orion-surface))" }}
            >
              {suggestion.sku}
            </span>
            <EstampaTag
              code={suggestion.print_design_code}
              name={suggestion.print_design_name}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            onClick={onAccept}
            disabled={pending}
            data-testid={`mapping-accept-${item.id}`}
            className="h-auto gap-1 rounded-[6px] bg-[color:var(--brand-sales)] px-2.5 py-1 text-[12px] font-medium text-white hover:brightness-95"
          >
            {t("actions.accept")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setManual(true)}
            disabled={pending}
            data-testid={`mapping-swap-${item.id}`}
            className="h-auto rounded-[6px] px-2.5 py-1 text-[12px]"
          >
            {t("actions.swap")}
          </Button>
        </div>
      </div>
    );
  }

  // Manual mode: product picker → variation (SKU) picker.
  return (
    <div
      className="flex items-center gap-2"
      data-testid={`mapping-manual-${item.id}`}
    >
      <div className="min-w-0 flex-1">
        <Select
          value={productId}
          onValueChange={(v) => setProductId(v)}
          disabled={pending}
        >
          <SelectTrigger className="h-auto w-full rounded-[8px] border-[color:var(--orion-line)] py-2 text-[13px]">
            <SelectValue placeholder={t("manual.chooseProduct")} />
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
        className="shrink-0 text-[color:var(--orion-ink-3)]"
      />
      <div className="min-w-0 flex-1">
        {selectedProduct ? (
          <Select
            onValueChange={(v) => onSetVariation(v)}
            disabled={pending}
          >
            <SelectTrigger className="h-auto w-full rounded-[8px] border-[color:var(--orion-line)] py-2 text-[13px]">
              <SelectValue placeholder={t("manual.chooseVariation")} />
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
          <div className="whitespace-nowrap overflow-hidden text-ellipsis rounded-[8px] border border-dashed border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] px-[11px] py-2 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("manual.pickProductFirst")}
          </div>
        )}
      </div>
      {suggestion ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setManual(false)}
          disabled={pending}
          title={t("manual.backToSuggestion")}
          className="h-auto shrink-0 rounded-[6px] px-2 py-1 text-[color:var(--brand-sales)]"
        >
          <Sparkles size={13} />
        </Button>
      ) : null}
    </div>
  );
}
