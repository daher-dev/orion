"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Boxes,
  Check,
  Gift,
  Minus,
  PackageCheck,
  Plus,
  PlusCircle,
  Search,
  ShoppingBag,
  Undo2,
  type LucideIcon,
} from "lucide-react";
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
import { ApiError } from "@/lib/api-client";
import {
  useCreateStockEntry,
  useCreateStockExit,
  useStockLevels,
  useStockMovements,
} from "@/hooks/use-stock";
import { StockStatusPill } from "@/components/stock/StockStatusPill";
import {
  type StockEntryCreate,
  type StockExitCreate,
  type StockMovementRead,
  type VariationStockRead,
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
 * Direct port of `MOVE_TYPES` from `/docs/design/source/pages/inventory.jsx`.
 *
 * The design surfaces six tiles in a 2-col grid that fold direction + reason
 * into a single picker. Backend currently models direction (entry/exit) and
 * reason/source as separate enums, so each tile here knows which mutation to
 * call and which reason/source code to persist:
 *
 *   entry  shipment    →  "Receipt"     pieces back from sewing
 *   entry  return      →  "Return"      customer return
 *   entry  adjustment  →  "Adjust (+)"  inventory correction
 *   exit   sale        →  "Order"       shipped to customer
 *   exit   loss        →  "Damage"      damaged piece
 *   exit   adjustment  →  "Adjust (−)"  inventory correction (re-labelled
 *                                       from the design's "Brinde" since the
 *                                       backend has no `gift` reason yet)
 */
type MoveType = {
  /** Stable id used as map key + data-testid suffix. */
  id: string;
  /** Mutation direction — picks entry vs exit endpoint. */
  direction: "entry" | "exit";
  /** Backend enum value persisted as `source` (entry) or `reason` (exit). */
  code: StockEntryCreate["source"] | StockExitCreate["reason"];
  /** i18n leaf under `stock.adjust.moveTypes` for { label, desc }. */
  i18nKey:
    | "shipment"
    | "return"
    | "entryAdjustment"
    | "sale"
    | "loss"
    | "exitAdjustment";
  icon: LucideIcon;
};

const MOVE_TYPES: readonly MoveType[] = [
  { id: "entrada-banca", direction: "entry", code: "shipment", i18nKey: "shipment", icon: PackageCheck },
  { id: "entrada-devol", direction: "entry", code: "return", i18nKey: "return", icon: Undo2 },
  { id: "entrada-ajuste", direction: "entry", code: "adjustment", i18nKey: "entryAdjustment", icon: PlusCircle },
  { id: "saida-pedido", direction: "exit", code: "sale", i18nKey: "sale", icon: ShoppingBag },
  { id: "saida-avaria", direction: "exit", code: "loss", i18nKey: "loss", icon: AlertTriangle },
  { id: "saida-brinde", direction: "exit", code: "adjustment", i18nKey: "exitAdjustment", icon: Gift },
] as const;

/**
 * Sheet for recording a manual stock adjustment. The single sheet handles
 * both directions — picking `+` triggers POST /stock/entries, `-` triggers
 * POST /stock/exits.
 *
 * When `variation` is null, a SKU search step is shown first so the operator
 * can pick which variant to adjust (used when opened from the page header).
 */
function defaultMoveTypeFor(direction?: "entry" | "exit"): MoveType {
  return MOVE_TYPES.find((m) => m.direction === (direction ?? "entry")) ?? MOVE_TYPES[0];
}

function moveTypeLabel(t: ReturnType<typeof useTranslations>, key: MoveType["i18nKey"]) {
  return t(`moveTypes.${key}.label`);
}

function moveTypeDesc(t: ReturnType<typeof useTranslations>, key: MoveType["i18nKey"]) {
  return t(`moveTypes.${key}.desc`);
}

export function StockAdjustDialog({ open, onOpenChange, variation, defaultDirection }: Props) {
  const t = useTranslations("stock.adjust");
  const format = useFormatter();

  const [moveType, setMoveType] = useState<MoveType>(defaultMoveTypeFor(defaultDirection));
  const [quantity, setQuantity] = useState<string>("1");
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

  // Recent movements list — the design source's "Últimas movimentações"
  // section. We pull the latest 3 entries for the active SKU so the operator
  // has context for the adjustment they're about to make.
  const recentMovements = useStockMovements(
    open && activeVariation
      ? { variation_id: activeVariation.variation_id, page_size: 3 }
      : undefined,
  );

  // Reset form state whenever the sheet opens for a new variation.
  const variationKey = `${open ? "1" : "0"}|${activeVariation?.variation_id ?? ""}|${defaultDirection ?? "entry"}`;
  const [lastKey, setLastKey] = useState(variationKey);
  if (lastKey !== variationKey) {
    setLastKey(variationKey);
    setMoveType(defaultMoveTypeFor(defaultDirection));
    setQuantity("1");
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
  const direction = moveType.direction;

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
          source: moveType.code as StockEntryCreate["source"],
          notes: notes.trim() ? notes.trim() : null,
        };
        await createEntry.mutateAsync(payload);
        toast.success(t("toasts.entryCreated"));
      } else {
        const payload: StockExitCreate = {
          variation_id: activeVariation.variation_id,
          quantity: parsedQty,
          reason: moveType.code as StockExitCreate["reason"],
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

            {/* Movement-type tile grid — direct port of `MOVE_TYPES` from
                /docs/design/source/pages/inventory.jsx (lines ~256 + ~474-503).
                Six tiles in a 2-col grid. Each tile shows: 32×32 tinted icon
                (status-ok for entries / status-err for exits), label, 11px
                description. Active tile gets a 1.5px coloured border + 8%
                surface mix. Picking a tile bakes both direction + reason into
                the single move-type state. */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASS}>{t("labels.moveType")}</span>
              <div className="grid grid-cols-2 gap-2">
                {MOVE_TYPES.map((m) => {
                  const active = m.id === moveType.id;
                  const tone =
                    m.direction === "entry"
                      ? "var(--status-ok)"
                      : "var(--status-err)";
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`stock-adjust-movetype-${m.id}`}
                      data-active={active || undefined}
                      onClick={() => setMoveType(m)}
                      className="group/movetype flex items-center gap-3 rounded-[10px] border bg-[color:var(--orion-surface)] px-[14px] py-[12px] text-left transition-colors hover:bg-[color:var(--orion-surface-2)]"
                      style={{
                        borderColor: active ? tone : "var(--orion-line)",
                        borderWidth: active ? 1.5 : 1,
                        background: active
                          ? `color-mix(in oklab, ${tone} 8%, var(--orion-surface))`
                          : undefined,
                      }}
                    >
                      <span
                        aria-hidden
                        className="grid size-8 flex-shrink-0 place-items-center rounded-[8px]"
                        style={{
                          background: `color-mix(in oklab, ${tone} 14%, var(--orion-surface))`,
                          color: tone,
                        }}
                      >
                        <Icon size={16} strokeWidth={1.8} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="text-[13px] text-[color:var(--orion-ink)]"
                          style={{ fontWeight: active ? 600 : 500 }}
                        >
                          {moveTypeLabel(t, m.i18nKey)}
                        </span>
                        <span className="mt-[1px] text-[11px] text-[color:var(--orion-ink-3)]">
                          {moveTypeDesc(t, m.i18nKey)}
                        </span>
                      </span>
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

            {/* Recent movements — direct port of "Últimas movimentações"
                from /docs/design/source/pages/inventory.jsx (lines ~543-558).
                Section divider (line-soft border-top + section-title label)
                followed by rows: 26×26 colored circular badge with arrow,
                reason + date stack, signed quantity in display font on the
                right (--status-ok for entries, --status-err for exits). */}
            <div
              className="border-t border-[color:var(--orion-line-soft)] pt-3.5"
              data-testid="stock-adjust-recent"
            >
              <span className={FIELD_LABEL_CLASS}>{t("labels.recent")}</span>
              <div className="mt-1.5">
                {recentMovements.isPending ? (
                  <p className="py-3 text-center text-[12px] text-[color:var(--orion-ink-3)]">
                    …
                  </p>
                ) : recentMovements.data?.items.length ? (
                  recentMovements.data.items.map((m, i, arr) => (
                    <RecentMovementRow
                      key={m.id}
                      movement={m}
                      last={i === arr.length - 1}
                      formatDate={(iso) =>
                        format.dateTime(new Date(iso), {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      }
                      labelFor={(reason) => t(`moveTypes.${reason}.label`)}
                    />
                  ))
                ) : (
                  <p className="py-3 text-[12px] text-[color:var(--orion-ink-3)]">
                    {t("noRecent")}
                  </p>
                )}
              </div>
            </div>
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

/**
 * One row of the "Recent movements" footer list — port of the inline rows
 * in inventory.jsx (lines ~547-557). Entries get a downward arrow + ok tint;
 * exits get an upward arrow + err tint. Quantity is rendered with a leading
 * sign in the display font on the right rail.
 */
function RecentMovementRow({
  movement,
  last,
  formatDate,
  labelFor,
}: {
  movement: StockMovementRead;
  last: boolean;
  formatDate: (iso: string) => string;
  labelFor: (
    key:
      | "shipment"
      | "return"
      | "entryAdjustment"
      | "sale"
      | "loss"
      | "exitAdjustment",
  ) => string;
}) {
  const isEntry = movement.type === "entry";
  const tone = isEntry ? "var(--status-ok)" : "var(--status-err)";
  // Map the persisted enum back to the i18n key the move-type tile uses,
  // so the recent rows stay in sync with the picker labels.
  const i18nKey: Parameters<typeof labelFor>[0] = isEntry
    ? movement.source === "adjustment"
      ? "entryAdjustment"
      : movement.source === "shipment"
        ? "shipment"
        : "return"
    : movement.reason === "adjustment"
      ? "exitAdjustment"
      : movement.reason === "sale"
        ? "sale"
        : "loss";

  return (
    <div
      className="flex items-center gap-2.5 py-2"
      style={{
        borderBottom: last ? "none" : "1px solid var(--orion-line-soft)",
      }}
    >
      <span
        aria-hidden
        className="grid size-[26px] flex-shrink-0 place-items-center rounded-full"
        style={{
          background: `color-mix(in oklab, ${tone} 14%, var(--orion-surface))`,
          color: tone,
        }}
      >
        {isEntry ? (
          <ArrowDown size={13} strokeWidth={2} />
        ) : (
          <ArrowUp size={13} strokeWidth={2} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] text-[color:var(--orion-ink)]">
          {labelFor(i18nKey)}
        </span>
        <span className="text-[11px] text-[color:var(--orion-ink-3)]">
          {formatDate(movement.created_at)}
        </span>
      </div>
      <span
        className="font-serif text-[16px] tabular-nums"
        style={{ color: tone }}
      >
        {isEntry ? "+" : "−"}
        {movement.quantity}
      </span>
    </div>
  );
}
