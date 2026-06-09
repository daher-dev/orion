"use client";

import { Stamp } from "lucide-react";
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
import { PrintStockMovementsTable } from "@/components/print-stock/PrintStockMovementsTable";
import { usePrintStockMovements } from "@/hooks/use-print-stock";
import type { PrintStockLevelRead } from "@/lib/schemas/print-stock";

type Props = {
  level: PrintStockLevelRead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdjust?: (level: PrintStockLevelRead) => void;
};

/**
 * Right-side drawer showing the movement history for a single (estampa, colour).
 * Mirrors the design's Sheet-with-hero pattern from inventory.jsx.
 */
export function PrintStockMovementsDrawer({ level, open, onOpenChange, onAdjust }: Props) {
  const t = useTranslations("printStock");
  const { data, isPending, isError } = usePrintStockMovements(
    level
      ? { print_design_id: level.print_design_id, product_color: level.product_color }
      : { print_design_id: "__skip__" },
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="print-movements-drawer"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[620px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("drawer.title")}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("drawer.title")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          {level ? (
            <div
              className="mb-4 flex items-center gap-3 rounded-[12px] bg-[color:var(--orion-surface-2)] p-4"
              data-testid="print-movements-drawer-hero"
            >
              <span
                className="grid size-12 place-items-center overflow-hidden rounded-[10px] bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)]"
                aria-hidden
              >
                {level.design.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={level.design.image_url} alt="" className="size-full object-cover" />
                ) : (
                  <Stamp size={22} strokeWidth={1.5} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-serif text-[17px] text-[color:var(--orion-ink)]">{level.design.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--orion-ink-2)]">
                  <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">{level.design.code}</span>
                  <span>{level.product_color}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-[24px] leading-none text-[color:var(--orion-ink)]">
                  {level.on_hand}
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
            <PrintStockMovementsTable data={data.items} showDesign={false} />
          ) : (
            <div
              data-testid="print-movements-drawer-empty"
              className="px-4 py-12 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
            >
              {t("drawer.empty")}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          {level && onAdjust ? (
            <Button
              type="button"
              data-testid="print-drawer-adjust-button"
              onClick={() => onAdjust(level)}
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
