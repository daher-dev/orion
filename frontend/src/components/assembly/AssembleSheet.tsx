"use client";

import { useMemo, useState } from "react";
import { Combine, Shirt, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { QtySpinner } from "@/components/inventory/QtySpinner";
import { ColorDot } from "@/components/inventory/ColorDot";
import { SideGlyph } from "@/components/inventory/SideGlyph";
import { TransferChip } from "@/components/inventory/TransferChip";
import { ApiError } from "@/lib/api-client";
import { useBlankStockLevels } from "@/hooks/use-blank-stock";
import { usePrintedTransferLevels } from "@/hooks/use-printed-transfers";
import { useAssemble } from "@/hooks/use-assembly";
import { makeSku } from "@/lib/schemas/assembly";

/**
 * Manual assemble ("Montagem avulsa") sheet — port of the prototype's
 * MontagemModal. Pick an in-stock blank piece + an in-stock printed transfer,
 * choose a quantity clamped to `min(blank.on_hand, printed.on_hand)`, preview
 * the resulting SKU, and assemble. A 409 (insufficient on-hand) surfaces inline.
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";
const SECTION_CLASS =
  "mb-[10px] mt-[18px] border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

export function AssembleSheet({ open, onOpenChange }: Props) {
  const t = useTranslations("assembly");
  const assemble = useAssemble();

  const blanks = useBlankStockLevels(open ? { page_size: 100 } : {});
  const printed = usePrintedTransferLevels(open ? { page_size: 100 } : {});

  const [blankId, setBlankId] = useState("");
  const [printedId, setPrintedId] = useState("");
  const [qty, setQty] = useState("1");
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset the form each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    if (open) {
      setBlankId("");
      setPrintedId("");
      setQty("1");
      setServerError(null);
    }
    setWasOpen(open);
  }

  const blankRows = useMemo(
    () => (blanks.data?.items ?? []).filter((b) => b.on_hand > 0),
    [blanks.data],
  );
  const printedRows = useMemo(
    () => (printed.data?.items ?? []).filter((p) => p.on_hand > 0),
    [printed.data],
  );

  const blank = blankRows.find((b) => b.blank_piece_id === blankId);
  const transfer = printedRows.find((p) => p.printed_transfer_id === printedId);

  const max = blank && transfer ? Math.min(blank.on_hand, transfer.on_hand) : 0;
  const qtyNum = Math.max(0, Number(qty) || 0);
  const clampedQty = Math.min(qtyNum, max || qtyNum);
  const overMax = max > 0 && qtyNum > max;

  const sku =
    blank && transfer ? makeSku(blank.spec.code, blank.size, blank.color_code, transfer.design.code) : null;
  const productName = blank && transfer ? `${blank.spec.name} · ${transfer.design.name}` : null;

  const canSubmit = !!blank && !!transfer && clampedQty > 0 && !assemble.isPending;

  async function handleSubmit() {
    if (!blank || !transfer) return;
    setServerError(null);
    try {
      const run = await assemble.mutateAsync({
        blank_piece_id: blank.blank_piece_id,
        printed_transfer_id: transfer.printed_transfer_id,
        quantity: clampedQty,
      });
      toast.success(t("toasts.assembled", { n: run.quantity, sku: run.sku }));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const match = /(\d+)/.exec(err.detail);
        const available = match ? Number(match[1]) : max;
        setServerError(t("toasts.insufficient", { available }));
        return;
      }
      toast.error(t("toasts.error"));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CLASS} data-testid="assemble-sheet">
        <SheetHeader
          className="flex-col gap-0.5 border-b border-[color:var(--orion-line-soft)] p-0"
          style={{ padding: "18px 22px" }}
        >
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("manualSheet.title")}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
            {t("manualSheet.sub")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" style={{ padding: "18px 22px" }}>
          {/* Blank selector */}
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--orion-ink-2)]">
            <Shirt size={13} strokeWidth={1.8} />
            {t("manualSheet.blank")}
          </div>
          <div className="mt-1.5">
            <Select value={blankId} onValueChange={setBlankId}>
              <SelectTrigger className={FIELD_INPUT_CLASS} data-testid="assemble-blank-select">
                <SelectValue placeholder={t("manualSheet.blankPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {blankRows.map((b) => (
                  <SelectItem key={b.blank_piece_id} value={b.blank_piece_id}>
                    <span className="inline-flex items-center gap-2">
                      <ColorDot name={b.color} size={12} />
                      {b.spec.name} · {b.color} · {b.size.toUpperCase()}
                      <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                        {t("manualSheet.onHand", { n: b.on_hand })}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {blankRows.length === 0 && !blanks.isPending ? (
              <p className="mt-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">{t("empty.noStock")}</p>
            ) : null}
          </div>

          {/* Printed selector */}
          <div className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--orion-ink-2)]">
            <Stamp size={13} strokeWidth={1.8} />
            {t("manualSheet.printed")}
          </div>
          <div className="mt-1.5">
            <Select value={printedId} onValueChange={setPrintedId}>
              <SelectTrigger className={FIELD_INPUT_CLASS} data-testid="assemble-printed-select">
                <SelectValue placeholder={t("manualSheet.printedPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {printedRows.map((p) => (
                  <SelectItem key={p.printed_transfer_id} value={p.printed_transfer_id}>
                    <span className="inline-flex items-center gap-2">
                      <TransferChip imageUrl={p.design.image_url} size={20} />
                      {p.design.name}
                      <SideGlyph side={p.side} size={12} />
                      <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                        {t("manualSheet.onHand", { n: p.on_hand })}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {printedRows.length === 0 && !printed.isPending ? (
              <p className="mt-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">{t("empty.noStock")}</p>
            ) : null}
          </div>

          {/* Quantity */}
          <div className={SECTION_CLASS}>{t("manualSheet.quantity")}</div>
          <QtySpinner
            value={qty}
            onChange={setQty}
            min={1}
            step={1}
            testId="assemble-qty"
            invalid={overMax}
          />
          {max > 0 ? (
            <p className="mt-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
              {t("manualSheet.maxHint", { max })}
            </p>
          ) : null}

          {/* Product preview */}
          {blank && transfer ? (
            <>
              <div className={SECTION_CLASS}>{t("manualSheet.productPreview")}</div>
              <div
                className="rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] p-3.5"
                data-testid="assemble-preview"
              >
                <div className="flex items-center gap-3">
                  <TransferChip imageUrl={transfer.design.image_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-[15px] text-[color:var(--orion-ink)]">{productName}</div>
                    <div className="mt-0.5 font-mono text-[12px] text-[color:var(--orion-ink-2)]">{sku}</div>
                  </div>
                </div>
                {/* −1 lisa −1 impresso = +1 produto */}
                <div className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-[color:var(--orion-ink-3)]">
                  <span className="text-[color:var(--status-warn)]">
                    −{clampedQty} {t("comp.blankShort")}
                  </span>
                  <span className="text-[color:var(--status-warn)]">
                    −{clampedQty} {t("comp.printedShort")}
                  </span>
                  <span className="text-[color:var(--status-ok)]">= +{clampedQty}</span>
                </div>
              </div>
            </>
          ) : null}

          {serverError ? (
            <p className="mt-3 text-[12px] text-[color:var(--status-err)]" data-testid="assemble-error">
              {serverError}
            </p>
          ) : null}
        </div>

        <SheetFooter
          className="flex-row items-center justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0"
          style={{ padding: "14px 22px" }}
        >
          <Button
            type="button"
            variant="ghost"
            className="h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
            onClick={() => onOpenChange(false)}
          >
            {t("manualSheet.cancel")}
          </Button>
          <Button
            type="button"
            data-testid="assemble-submit"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
            style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
          >
            <Combine size={13} strokeWidth={1.8} />
            {t("actions.build", { n: clampedQty })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
