"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, type LucideIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { QtySpinner } from "@/components/inventory/QtySpinner";

/**
 * One movement-type tile in the picker. `dir` drives the preview sign and the
 * red/green tint; `kind` is the backend movement kind persisted on apply; the
 * optional `note` is attached by tiles like Avaria/Refugo that are exits with a
 * fixed reason. `i18nKey` resolves `{ label, desc }` under
 * `<namespace>.moveSheet.moveTypes.*`.
 */
export type UnitMoveType = {
  id: string;
  dir: "+" | "-";
  kind: "entry" | "exit" | "adjustment";
  i18nKey: string;
  icon: LucideIcon;
  /** Optional fixed note (e.g. "Avaria") sent with the movement. */
  note?: string;
};

/** Tier-agnostic item the sheet is acting on. */
export type UnitMoveItem = {
  /** Human label (e.g. "Camiseta · Preto · M"). */
  label: ReactNode;
  on_hand: number;
  min_stock?: number | null;
};

export type RecentMove = {
  id: string;
  kind: "entry" | "exit" | "adjustment";
  quantity: number;
  created_at: string;
  reasonLabel: ReactNode;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected item; null shows nothing (page should keep sheet closed). */
  item: UnitMoveItem | null;
  /** Optional hero block rendered at the top (per-tier visual identity). */
  hero?: ReactNode;
  moveTypes: readonly UnitMoveType[];
  /** Last-N movements for the active item. */
  moves?: RecentMove[];
  /** i18n namespace exposing `moveSheet.*`. */
  i18nNamespace: string;
  /** data-testid prefix for the move-type tiles / qty / submit. */
  testIdPrefix: string;
  /** Pending state from the page mutation. */
  isPending?: boolean;
  /** Server error to surface inline (e.g. insufficient on-hand 409). */
  serverError?: string | null;
  /** Apply handler — the page builds + submits the tier-specific payload. */
  onApply: (moveType: UnitMoveType, quantity: number) => void | Promise<void>;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

/**
 * Generalised counted-unit movement sheet — generalises
 * `components/stock/StockAdjustDialog.tsx` and the prototype `UnitMoveSheet`.
 *
 * Layout: hero → move-type tile grid (entrada/saída/ajuste + avaria/refugo) →
 * qty stepper → `current ± move = final` preview with negative/low colouring →
 * last-N movements. Tier-agnostic: blank + printed pass their own move types,
 * hero, and apply handler; the on-hand guard / 409 handling lives in the page.
 */
export function UnitMoveSheet({
  open,
  onOpenChange,
  item,
  hero,
  moveTypes,
  moves = [],
  i18nNamespace,
  testIdPrefix,
  isPending,
  serverError,
  onApply,
}: Props) {
  const t = useTranslations(`${i18nNamespace}.moveSheet`);
  const format = useFormatter();
  const formId = useId();

  const [moveTypeId, setMoveTypeId] = useState<string>(moveTypes[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [quantityError, setQuantityError] = useState<string | null>(null);

  // Reset form whenever the sheet opens for a (different) item.
  const resetKey = `${open ? "1" : "0"}|${item ? "item" : "none"}`;
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setMoveTypeId(moveTypes[0]?.id ?? "");
    setQuantity("1");
    setQuantityError(null);
  }

  const moveType = moveTypes.find((m) => m.id === moveTypeId) ?? moveTypes[0];
  const parsedQty = Number(quantity);
  const qtyIsValid = Number.isInteger(parsedQty) && parsedQty > 0;
  const delta = moveType?.dir === "+" ? parsedQty : -parsedQty;
  const onHand = item?.on_hand ?? 0;
  const minStock = item?.min_stock ?? 0;
  const projected = onHand + (qtyIsValid ? delta : 0);

  async function handleSubmit() {
    if (!item || !moveType) return;
    if (!qtyIsValid) {
      setQuantityError(t("validation.quantityPositive"));
      return;
    }
    setQuantityError(null);
    await onApply(moveType, parsedQty);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid={`${testIdPrefix}-move-sheet`}
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </SheetDescription>
        </SheetHeader>

        <form
          id={formId}
          className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {hero}

          {/* Move-type tile grid */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("labels.moveType")}</span>
            <div className="grid grid-cols-2 gap-2">
              {moveTypes.map((m) => {
                const active = m.id === moveType?.id;
                const tone = m.dir === "+" ? "var(--status-ok)" : "var(--status-err)";
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`${testIdPrefix}-movetype-${m.id}`}
                    data-active={active || undefined}
                    onClick={() => setMoveTypeId(m.id)}
                    className="flex items-center gap-3 rounded-[10px] border bg-[color:var(--orion-surface)] px-[14px] py-[12px] text-left transition-colors hover:bg-[color:var(--orion-surface-2)]"
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
                        {t(`moveTypes.${m.i18nKey}.label`)}
                      </span>
                      <span className="mt-[1px] text-[11px] text-[color:var(--orion-ink-3)]">
                        {t(`moveTypes.${m.i18nKey}.desc`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity stepper */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("labels.quantity")}</span>
            <QtySpinner
              value={quantity}
              onChange={(next) => {
                setQuantity(next);
                setQuantityError(null);
              }}
              invalid={!!quantityError}
              testId={`${testIdPrefix}-quantity`}
            />
            {quantityError ? (
              <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                {quantityError}
              </p>
            ) : null}
          </div>

          {/* Projected preview: current ± move = final */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("labels.preview")}</span>
            <div
              className="grid items-center gap-2 rounded-[12px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3 py-3"
              style={{ gridTemplateColumns: "1fr auto 1fr auto 1fr" }}
              data-testid={`${testIdPrefix}-preview`}
            >
              <div className="text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {t("preview.current")}
                </div>
                <div className="font-serif text-[32px] leading-[1.1] text-[color:var(--orion-ink)] tabular-nums">
                  {onHand}
                </div>
              </div>
              <span className="font-serif text-[24px] text-[color:var(--orion-ink-3)]">
                {moveType?.dir === "+" ? "+" : "−"}
              </span>
              <div className="text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {moveType?.dir === "+" ? t("preview.entry") : t("preview.exit")}
                </div>
                <div
                  className="font-serif text-[32px] leading-[1.1] tabular-nums"
                  style={{ color: moveType?.dir === "+" ? "var(--status-ok)" : "var(--status-err)" }}
                >
                  {qtyIsValid ? parsedQty : 0}
                </div>
              </div>
              <span className="font-serif text-[24px] text-[color:var(--orion-ink-3)]">=</span>
              <div className="text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {t("preview.final")}
                </div>
                <div
                  className="font-serif text-[32px] leading-[1.1] tabular-nums"
                  data-testid={`${testIdPrefix}-preview-final`}
                  style={{
                    color:
                      projected < 0
                        ? "var(--status-err)"
                        : projected <= minStock
                          ? "var(--status-warn)"
                          : "var(--orion-ink)",
                  }}
                >
                  {projected}
                </div>
              </div>
            </div>
            {projected < 0 ? (
              <p
                data-testid={`${testIdPrefix}-negative-warning`}
                className="flex items-center gap-1 text-[11.5px] text-[color:var(--status-err)]"
              >
                <AlertTriangle size={11} />
                {t("preview.negativeWarning")}
              </p>
            ) : projected <= minStock && minStock > 0 ? (
              <p className="flex items-center gap-1 text-[11.5px] text-[color:var(--status-warn)]">
                <AlertTriangle size={11} />
                {t("preview.lowWarning")}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <div
              role="alert"
              data-testid={`${testIdPrefix}-server-error`}
              className="rounded-[8px] border border-[color:var(--status-err)] bg-[color:var(--status-err-bg)] px-3 py-2 text-[12px] text-[color:var(--status-err)]"
            >
              {serverError}
            </div>
          ) : null}

          {/* Recent movements */}
          {moves.length > 0 ? (
            <div
              className="border-t border-[color:var(--orion-line-soft)] pt-3.5"
              data-testid={`${testIdPrefix}-recent`}
            >
              <span className={FIELD_LABEL_CLASS}>{t("labels.recent")}</span>
              <div className="mt-1.5">
                {moves.map((m, i, arr) => {
                  const isCredit = m.kind === "entry" || m.kind === "adjustment";
                  const tone = isCredit ? "var(--status-ok)" : "var(--status-err)";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 py-2"
                      style={{
                        borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--orion-line-soft)",
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
                        {isCredit ? <ArrowDown size={13} strokeWidth={2} /> : <ArrowUp size={13} strokeWidth={2} />}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[12.5px] text-[color:var(--orion-ink)]">
                          {m.reasonLabel}
                        </span>
                        <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                          {format.dateTime(new Date(m.created_at), { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                      <span className="font-serif text-[16px] tabular-nums" style={{ color: tone }}>
                        {isCredit ? "+" : "−"}
                        {m.quantity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </form>

        <SheetFooter className="mt-auto border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
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
            disabled={isPending || !item}
            data-testid={`${testIdPrefix}-submit`}
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
          >
            <Check size={13} />
            {t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
