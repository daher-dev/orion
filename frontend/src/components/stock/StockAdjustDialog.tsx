"use client";

import { useId, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Check,
  Minus,
  Plus,
  Search,
} from "lucide-react";
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
import { useCreateStockEntry, useCreateStockExit, useStockLevels } from "@/hooks/use-stock";
import { StockStatusPill } from "@/components/stock/StockStatusPill";
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
 * Sheet for recording a manual stock adjustment. The single sheet handles
 * both directions — picking `+` triggers POST /stock/entries, `-` triggers
 * POST /stock/exits.
 *
 * When `variation` is null, a SKU search step is shown first so the operator
 * can pick which variant to adjust (used when opened from the page header).
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

  // SKU picker state — used when sheet opened without a pre-selected variation.
  const [skuSearch, setSkuSearch] = useState("");
  const [pickedVariation, setPickedVariation] = useState<VariationStockRead | null>(null);

  const formId = useId();
  const createEntry = useCreateStockEntry();
  const createExit = useCreateStockExit();
  const isPending = createEntry.isPending || createExit.isPending;

  // Fetch variations for the SKU picker only when no variation is pre-selected.
  const skuPickerEnabled = open && variation === null;
  const stockLevels = useStockLevels(
    skuPickerEnabled ? { q: skuSearch || undefined, page_size: 20 } : undefined,
  );

  // The effective variation: pre-selected prop takes priority, then the picked one.
  const activeVariation = variation ?? pickedVariation;

  // Reset form state whenever the sheet opens for a new variation.
  const variationKey = `${open ? "1" : "0"}|${activeVariation?.variation_id ?? ""}|${defaultDirection ?? "entry"}`;
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

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setPickedVariation(null);
      setSkuSearch("");
    }
    onOpenChange(nextOpen);
  }

  const parsedQty = Number(quantity);
  const qtyIsValid = Number.isInteger(parsedQty) && parsedQty > 0;

  const projected =
    direction === "entry"
      ? (activeVariation?.on_hand ?? 0) + (qtyIsValid ? parsedQty : 0)
      : (activeVariation?.on_hand ?? 0) - (qtyIsValid ? parsedQty : 0);

  async function handleSubmit() {
    if (!activeVariation) {
      setServerError(t("validation.variationRequired"));
      return;
    }
    if (!qtyIsValid) {
      setQuantityError(t("validation.quantityPositive"));
      return;
    }
    setQuantityError(null);
    setServerError(null);

    try {
      if (direction === "entry") {
        const payload: StockEntryCreate = {
          variation_id: activeVariation.variation_id,
          quantity: parsedQty,
          source: source as StockEntryCreate["source"],
          notes: notes.trim() ? notes.trim() : null,
        };
        await createEntry.mutateAsync(payload);
        toast.success(t("toasts.entryCreated"));
      } else {
        const payload: StockExitCreate = {
          variation_id: activeVariation.variation_id,
          quantity: parsedQty,
          reason: reason as StockExitCreate["reason"],
          notes: notes.trim() ? notes.trim() : null,
        };
        await createExit.mutateAsync(payload);
        toast.success(t("toasts.exitCreated"));
      }
      handleClose(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const match = /(\d+)/.exec(err.detail);
        const available = match ? Number(match[1]) : activeVariation.on_hand;
        setServerError(t("validation.insufficientStock", { available }));
        return;
      }
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  const pickerItems = stockLevels.data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        data-testid="stock-adjust-dialog"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </SheetTitle>
          {activeVariation ? (
            <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
              {activeVariation.product.name} · {activeVariation.color} ·{" "}
              {activeVariation.size.toUpperCase()}
            </SheetDescription>
          ) : (
            <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
              {t("placeholders.search")}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Phase 1: SKU picker — shown when no variation is pre-selected or picked yet. */}
        {!activeVariation ? (
          <div className="flex flex-col gap-3 px-[22px] py-[18px]">
            <div className="flex items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[7px]">
              <Search size={13} className="shrink-0 text-[color:var(--orion-ink-3)]" />
              <Input
                data-testid="stock-sku-search"
                autoFocus
                placeholder={t("placeholders.search")}
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                className="h-auto border-0 bg-transparent p-0 text-[13px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
              />
            </div>
            <ul
              className="max-h-[300px] overflow-y-auto rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)]"
              data-testid="stock-sku-list"
            >
              {stockLevels.isPending ? (
                <li className="px-3 py-8 text-center text-[12.5px] text-[color:var(--orion-ink-3)]">
                  …
                </li>
              ) : pickerItems.length === 0 ? (
                <li className="px-3 py-8 text-center text-[12.5px] text-[color:var(--orion-ink-3)]">
                  {t("validation.variationRequired")}
                </li>
              ) : (
                pickerItems.map((item) => (
                  <li key={item.variation_id}>
                    <button
                      type="button"
                      data-testid={`stock-sku-item-${item.variation_id}`}
                      onClick={() => setPickedVariation(item)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] hover:bg-[color:var(--orion-surface-2)] [&:not(:last-child)]:border-b [&:not(:last-child)]:border-[color:var(--orion-line-soft)]"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium text-[color:var(--orion-ink)]">
                          {item.product.name}
                        </span>
                        <span className="font-mono text-[11.5px] text-[color:var(--orion-ink-3)]">
                          {item.sku} · {item.color} · {item.size.toUpperCase()}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[color:var(--orion-ink-2)]">
                        {item.on_hand}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          /* Phase 2: Adjustment form — shown after a variation is selected. */
          <form
            id={formId}
            className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[18px]"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {/* Hero — direct port of inventory.jsx AdjustStockBody hero
                (lines 442-464). 56×56 surface tile + product name (Fraunces
                17px) + chip row (color swatch, size pill, SKU mono). On the
                right: large status-colored count + status pill. */}
            <div
              className="flex items-center gap-3 rounded-[12px] bg-[color:var(--orion-surface-2)] p-[18px]"
              data-testid="stock-adjust-current"
            >
              <span
                aria-hidden
                className="grid size-14 flex-shrink-0 place-items-center rounded-[12px] bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)]"
              >
                <Boxes size={26} strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[17px] text-[color:var(--orion-ink)]">
                  {activeVariation.product.name}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[12px] text-[color:var(--orion-ink-2)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-3.5 rounded-full"
                      style={{
                        background: "var(--orion-surface)",
                        boxShadow:
                          "0 0 0 1px var(--orion-line), inset 0 0 0 1px rgba(255,255,255,.15)",
                      }}
                    />
                    {activeVariation.color}
                  </span>
                  <span
                    className="inline-flex items-center justify-center rounded-full border bg-[color:var(--orion-surface)] px-2 py-[2px] text-[11px] font-semibold tracking-[0.04em] text-[color:var(--orion-ink-2)]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      minWidth: 28,
                      borderColor: "var(--orion-line-soft)",
                    }}
                  >
                    {activeVariation.size.toUpperCase()}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                    {activeVariation.sku}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div
                  className="font-serif text-[28px] leading-none"
                  style={{
                    color:
                      activeVariation.on_hand <= 0
                        ? "var(--status-err)"
                        : activeVariation.on_hand < 10
                          ? "var(--status-warn)"
                          : "var(--status-ok)",
                  }}
                >
                  {activeVariation.on_hand}
                </div>
                <div className="mt-1">
                  <StockStatusPill onHand={activeVariation.on_hand} threshold={5} />
                </div>
              </div>
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

            {/* Quantity — stepper with -/+ buttons (matches design's AdjustStockBody).
                Display-font 22px center-aligned numeric input. Min clamped to 1. */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-qty`} className={FIELD_LABEL_CLASS}>
                {t("labels.quantity")}
              </label>
              <div className="flex max-w-[240px] items-center gap-2">
                <button
                  type="button"
                  data-testid="stock-adjust-qty-decrement"
                  aria-label="decrement"
                  onClick={() => {
                    const next = Math.max(1, (parsedQty || 1) - 1);
                    setQuantity(String(next));
                    setQuantityError(null);
                  }}
                  className="grid size-[38px] cursor-pointer place-items-center rounded-[6px] border bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-surface-2)]"
                  style={{ borderColor: "var(--orion-line)" }}
                >
                  <Minus size={14} strokeWidth={2} />
                </button>
                <input
                  id={`${formId}-qty`}
                  data-testid="stock-adjust-quantity"
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value.replace(/\D/g, ""));
                    setQuantityError(null);
                  }}
                  aria-invalid={!!quantityError}
                  className="flex-1 rounded-[8px] border bg-[color:var(--orion-surface)] py-[8px] text-center font-serif text-[22px] text-[color:var(--orion-ink)] outline-none tabular-nums"
                  style={{
                    borderColor: quantityError
                      ? "var(--status-err)"
                      : "var(--orion-line)",
                  }}
                />
                <button
                  type="button"
                  data-testid="stock-adjust-qty-increment"
                  aria-label="increment"
                  onClick={() => {
                    const next = (parsedQty || 0) + 1;
                    setQuantity(String(next));
                    setQuantityError(null);
                  }}
                  className="grid size-[38px] cursor-pointer place-items-center rounded-[6px] border bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-surface-2)]"
                  style={{ borderColor: "var(--orion-line)" }}
                >
                  <Plus size={14} strokeWidth={2} />
                </button>
              </div>
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

            {/* Projected on-hand preview — direct port of "Pré-visualização" from
                inventory.jsx. 5-col grid: Atual / sign / Entrada(or Saída) / = / Final,
                32px display numerals. Color cues turn the Final red below zero,
                amber when the resulting on-hand is critical. */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASS}>
                {t("labels.preview")}
              </span>
              <div
                className="grid items-center gap-2 rounded-[12px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3 py-3"
                style={{ gridTemplateColumns: "1fr auto 1fr auto 1fr" }}
                data-testid="stock-adjust-projected"
              >
                <div className="text-center">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("preview.current")}
                  </div>
                  <div className="font-serif text-[32px] leading-[1.1] text-[color:var(--orion-ink)]">
                    {activeVariation.on_hand}
                  </div>
                </div>
                <span className="font-serif text-[24px] text-[color:var(--orion-ink-3)]">
                  {direction === "entry" ? "+" : "−"}
                </span>
                <div className="text-center">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {direction === "entry"
                      ? t("preview.entry")
                      : t("preview.exit")}
                  </div>
                  <div
                    className="font-serif text-[32px] leading-[1.1]"
                    style={{
                      color:
                        direction === "entry"
                          ? "var(--status-ok)"
                          : "var(--status-err)",
                    }}
                  >
                    {qtyIsValid ? parsedQty : 0}
                  </div>
                </div>
                <span className="font-serif text-[24px] text-[color:var(--orion-ink-3)]">
                  =
                </span>
                <div className="text-center">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("preview.final")}
                  </div>
                  <div
                    className="font-serif text-[32px] leading-[1.1]"
                    style={{
                      color:
                        projected < 0
                          ? "var(--status-err)"
                          : projected < 10
                            ? "var(--status-warn)"
                            : "var(--orion-ink)",
                    }}
                  >
                    {projected}
                  </div>
                </div>
              </div>
              {projected < 0 ? (
                <p className="text-[11.5px] text-[color:var(--status-err)]">
                  {t("preview.negativeWarning")}
                </p>
              ) : projected >= 0 && projected < 10 ? (
                <p className="text-[11.5px] text-[color:var(--status-warn)]">
                  {t("preview.lowWarning")}
                </p>
              ) : null}
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
        )}

        <SheetFooter className="mt-auto border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isPending}
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("cancel")}
          </Button>
          {activeVariation ? (
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
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
