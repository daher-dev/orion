"use client";

import { Boxes } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MovementsTable } from "@/components/stock/MovementsTable";
import { useStockMovements } from "@/hooks/use-stock";
import type { VariationStockRead } from "@/lib/schemas/stock";

type Props = {
  variation: VariationStockRead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdjust?: (variation: VariationStockRead) => void;
};

/**
 * Right-side 480px drawer showing the movement history for a single variation.
 * Mirrors the design's Sheet-with-hero pattern from inventory.jsx.
 */
export function MovementsDrawer({ variation, open, onOpenChange, onAdjust }: Props) {
  const t = useTranslations("stock");
  const tSizes = useTranslations("products.variations.sizes");
  const { data, isPending, isError } = useStockMovements(
    variation ? { variation_id: variation.variation_id } : { variation_id: "__skip__" },
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="movements-drawer"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[620px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("drawer.title")}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("drawer.title")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          {variation ? (
            <div
              className="mb-4 flex items-center gap-3 rounded-[12px] bg-[color:var(--orion-surface-2)] p-4"
              data-testid="movements-drawer-hero"
            >
              <span
                className="grid size-12 place-items-center rounded-[10px] bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)]"
                aria-hidden
              >
                <Boxes size={22} strokeWidth={1.5} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[17px] text-[color:var(--orion-ink)]">
                  {variation.product.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--orion-ink-2)]">
                  <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                    {variation.sku}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-3 rounded-full"
                      style={{
                        background: "var(--orion-surface)",
                        boxShadow: "0 0 0 1px var(--orion-line)",
                      }}
                    />
                    {variation.color}
                  </span>
                  <span
                    className="inline-flex items-center justify-center rounded-full bg-[color:var(--orion-surface)] px-2 py-[2px] text-[11px] font-semibold tracking-[0.04em]"
                    style={{ fontFamily: "var(--font-mono)", minWidth: 24 }}
                  >
                    {tSizes(variation.size as never)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-[24px] leading-none text-[color:var(--orion-ink)]">
                  {variation.on_hand}
                </div>
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {t("table.columns.onHand")}
                </div>
              </div>
            </div>
          ) : null}

          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-7" />
              <Skeleton className="h-7" />
              <Skeleton className="h-7" />
            </div>
          ) : isError ? (
            <div className="px-4 py-12 text-center text-[12.5px] text-[color:var(--status-err)]">
              {t("adjust.toasts.error")}
            </div>
          ) : data?.items.length ? (
            <MovementsTable data={data.items} />
          ) : (
            <div
              data-testid="movements-drawer-empty"
              className="px-4 py-12 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
            >
              {t("drawer.empty")}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          {variation && onAdjust ? (
            <Button
              type="button"
              data-testid="drawer-adjust-button"
              onClick={() => onAdjust(variation)}
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
            >
              {t("actions.confirmAdjust")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("drawer.close")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
