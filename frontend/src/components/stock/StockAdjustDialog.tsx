"use client";

import { useId, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useCreateStockEntry, useCreateStockExit } from "@/hooks/use-stock";
import {
  STOCK_EXIT_REASONS,
  STOCK_SOURCES,
  type VariationStockRead,
  type StockEntryCreate,
  type StockExitCreate,
} from "@/lib/schemas/stock";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variation: VariationStockRead | null;
  defaultDirection?: "entry" | "exit";
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

/**
 * Dialog for recording a manual stock adjustment. The single dialog handles
 * both directions — picking `+` triggers POST /stock/entries, `-` triggers
 * POST /stock/exits. Mirrors AdjustStockBody from inventory.jsx.
 */
export function StockAdjustDialog({ open, onOpenChange, variation, defaultDirection }: Props) {
  const t = useTranslations("stock.adjust");
  const tActions = useTranslations("stock.actions");
  const tSources = useTranslations("stock.movements.sources");
  const tReasons = useTranslations("stock.movements.reasons");

  const [direction, setDirection] = useState<"entry" | "exit">(defaultDirection ?? "entry");
  const [quantity, setQuantity] = useState<string>("1");
  const [source, setSource] = useState<string>("adjustment");
  const [reason, setReason] = useState<string>("adjustment");
  const [notes, setNotes] = useState<string>("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);

  const formId = useId();
  const createEntry = useCreateStockEntry();
  const createExit = useCreateStockExit();
  const isPending = createEntry.isPending || createExit.isPending;

  // Reset state every time the dialog opens for a new variation. Using a
  // tracked-key pattern: when the {open, variation_id} pair changes from
  // closed→open, we reset all controlled-form state to defaults. The check
  // happens during render (cheap, idempotent) so we don't run into the
  // setState-in-effect lint rule.
  const variationKey = `${open ? "1" : "0"}|${variation?.variation_id ?? ""}|${defaultDirection ?? "entry"}`;
  const [lastKey, setLastKey] = useState(variationKey);
  if (lastKey !== variationKey) {
    setLastKey(variationKey);
    setDirection(defaultDirection ?? "entry");
    setQuantity("1");
    setSource("adjustment");
    setReason("adjustment");
    setNotes("");
    setServerError(null);
    setQuantityError(null);
  }

  if (!variation) return null;

  const parsedQty = Number(quantity);
  const qtyIsValid = Number.isInteger(parsedQty) && parsedQty > 0;

  const projected =
    direction === "entry"
      ? variation.on_hand + (qtyIsValid ? parsedQty : 0)
      : variation.on_hand - (qtyIsValid ? parsedQty : 0);

  async function handleSubmit() {
    if (!variation) return;
    if (!qtyIsValid) {
      setQuantityError(t("validation.quantityPositive"));
      return;
    }
    setQuantityError(null);
    setServerError(null);

    try {
      if (direction === "entry") {
        const payload: StockEntryCreate = {
          variation_id: variation.variation_id,
          quantity: parsedQty,
          source: source as StockEntryCreate["source"],
          notes: notes.trim() ? notes.trim() : null,
        };
        await createEntry.mutateAsync(payload);
        toast.success(t("toasts.entryCreated"));
      } else {
        const payload: StockExitCreate = {
          variation_id: variation.variation_id,
          quantity: parsedQty,
          reason: reason as StockExitCreate["reason"],
          notes: notes.trim() ? notes.trim() : null,
        };
        await createExit.mutateAsync(payload);
        toast.success(t("toasts.exitCreated"));
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Extract the available count from the detail string when present.
        const match = /(\d+)/.exec(err.detail);
        const available = match ? Number(match[1]) : variation.on_hand;
        setServerError(
          t("validation.insufficientStock", { available }),
        );
        return;
      }
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="stock-adjust-dialog"
        className="gap-0 border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 sm:max-w-[480px]"
      >
        <DialogHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <DialogTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
            {variation.product.name} · {variation.color} · {variation.size.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <form
          id={formId}
          className="flex max-h-[70vh] flex-col gap-[18px] overflow-y-auto px-[22px] py-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div
            className="flex items-center justify-between gap-3 rounded-[10px] bg-[color:var(--orion-surface-2)] px-3 py-2 text-[12.5px]"
            data-testid="stock-adjust-current"
          >
            <span className="text-[color:var(--orion-ink-3)]">
              {t("labels.variation")}: <span className="font-mono">{variation.sku}</span>
            </span>
            <span className="font-medium text-[color:var(--orion-ink)]">
              {variation.on_hand}
            </span>
          </div>

          {/* Direction toggle — +/- buttons. */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("labels.direction")}</span>
            <div className="grid grid-cols-2 gap-2">
              {(["entry", "exit"] as const).map((dir) => {
                const active = direction === dir;
                const tone = dir === "entry" ? "var(--status-ok)" : "var(--status-err)";
                return (
                  <button
                    key={dir}
                    type="button"
                    data-testid={`stock-adjust-direction-${dir}`}
                    onClick={() => setDirection(dir)}
                    style={{
                      border: active ? `1.5px solid ${tone}` : "1px solid var(--orion-line)",
                      background: active
                        ? `color-mix(in oklab, ${tone} 10%, var(--orion-surface))`
                        : "var(--orion-surface)",
                      color: active ? "var(--orion-ink)" : "var(--orion-ink-2)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {dir === "entry" ? (
                      <ArrowDownCircle size={14} style={{ color: tone }} />
                    ) : (
                      <ArrowUpCircle size={14} style={{ color: tone }} />
                    )}
                    {dir === "entry" ? tActions("adjustUp") : tActions("adjustDown")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-qty`} className={FIELD_LABEL_CLASS}>
              {t("labels.quantity")}
            </label>
            <Input
              id={`${formId}-qty`}
              data-testid="stock-adjust-quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value.replace(/\D/g, ""));
                setQuantityError(null);
              }}
              className={FIELD_INPUT_CLASS}
              aria-invalid={!!quantityError}
            />
            {quantityError ? (
              <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                {quantityError}
              </p>
            ) : null}
          </div>

          {/* Source / Reason */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-reason`} className={FIELD_LABEL_CLASS}>
              {direction === "entry" ? t("labels.source") : t("labels.reason")}
            </label>
            <Select
              value={direction === "entry" ? source : reason}
              onValueChange={(v) => (direction === "entry" ? setSource(v) : setReason(v))}
            >
              <SelectTrigger
                id={`${formId}-reason`}
                data-testid="stock-adjust-reason"
                className={FIELD_INPUT_CLASS}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {direction === "entry"
                  ? STOCK_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {tSources(s)}
                      </SelectItem>
                    ))
                  : STOCK_EXIT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {tReasons(r)}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-notes`} className={FIELD_LABEL_CLASS}>
              {t("labels.notes")}
            </label>
            <Input
              id={`${formId}-notes`}
              data-testid="stock-adjust-notes"
              autoComplete="off"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("placeholders.notes")}
              className={FIELD_INPUT_CLASS}
            />
          </div>

          {/* Projected on-hand preview */}
          <div
            className="grid grid-cols-3 items-center gap-2 rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3 py-3"
            data-testid="stock-adjust-projected"
          >
            <div className="text-center">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("labels.variation")}
              </div>
              <div className="font-serif text-[24px] leading-none text-[color:var(--orion-ink)]">
                {variation.on_hand}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {direction === "entry" ? "+" : "-"}
              </div>
              <div
                className="font-serif text-[24px] leading-none"
                style={{
                  color: direction === "entry" ? "var(--status-ok)" : "var(--status-err)",
                }}
              >
                {qtyIsValid ? parsedQty : 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                =
              </div>
              <div
                className="font-serif text-[24px] leading-none"
                style={{
                  color:
                    projected < 0
                      ? "var(--status-err)"
                      : projected <= 5
                        ? "var(--status-warn)"
                        : "var(--orion-ink)",
                }}
              >
                {projected}
              </div>
            </div>
          </div>

          {serverError ? (
            <div
              role="alert"
              data-testid="stock-adjust-server-error"
              className="rounded-[8px] border border-[color:var(--status-err)] bg-[color:var(--status-err-bg)] px-3 py-2 text-[12px] text-[color:var(--status-err)]"
            >
              {serverError}
            </div>
          ) : null}
        </form>

        <DialogFooter className="flex flex-row justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isPending}
            data-testid="stock-adjust-submit"
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
            style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
          >
            <Check size={13} />
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
