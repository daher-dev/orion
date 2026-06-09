"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, Check, Search, SlidersHorizontal, type LucideIcon } from "lucide-react";
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
import { NumberInput } from "@/components/ui/number-input";
import { ApiError } from "@/lib/api-client";
import { useCreateSupplyMovement, useSupplyLevels } from "@/hooks/use-supplies";
import type { SupplyLevelRead, SupplyMovementKind } from "@/lib/schemas/supply";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a supply (clicking a row in the levels table). */
  supply?: SupplyLevelRead | null;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

const KIND_CARDS: ReadonlyArray<{ kind: SupplyMovementKind; icon: LucideIcon; credit: boolean }> = [
  { kind: "entry", icon: ArrowUpRight, credit: true },
  { kind: "exit", icon: ArrowDownLeft, credit: false },
  { kind: "adjustment", icon: SlidersHorizontal, credit: true },
];

function num(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function trim(n: number): string {
  return Number.isFinite(n) ? String(n) : "0";
}

export function SupplyAdjustDialog({ open, onOpenChange, supply }: Props) {
  const t = useTranslations("supplies.adjust");
  const tKinds = useTranslations("supplies.kinds");
  const formId = useId();

  const [kind, setKind] = useState<SupplyMovementKind>("entry");
  const [supplyId, setSupplyId] = useState<string>(supply?.supply_id ?? "");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const { data } = useSupplyLevels();
  const levels = useMemo(() => data?.items ?? [], [data]);
  const createMovement = useCreateSupplyMovement();

  // When the picker is locked (a supply was passed in) use it directly,
  // otherwise resolve the selection from the live levels list.
  const selected: SupplyLevelRead | undefined =
    supply ?? levels.find((l) => l.supply_id === supplyId);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return levels;
    return levels.filter((l) => l.name.toLowerCase().includes(needle) || l.unit.toLowerCase().includes(needle));
  }, [levels, search]);

  const currentOnHand = num(selected?.on_hand);
  const qty = num(quantity);
  const credit = kind !== "exit";
  const finalOnHand = credit ? currentOnHand + qty : currentOnHand - qty;
  const wouldGoNegative = !credit && finalOnHand < 0;

  const effectiveSupplyId = supply?.supply_id ?? supplyId;
  const canSubmit = !!effectiveSupplyId && qty > 0 && !wouldGoNegative && !createMovement.isPending;

  const reset = () => {
    setKind("entry");
    setQuantity("");
    setNotes("");
    setSearch("");
    if (!supply) setSupplyId("");
  };

  const handleSubmit = async () => {
    if (!effectiveSupplyId || qty <= 0) return;
    try {
      await createMovement.mutateAsync({
        supply_id: effectiveSupplyId,
        kind,
        quantity: quantity.replace(",", "."),
        notes: notes.trim() ? notes.trim() : null,
      });
      toast.success(t("toasts.created"));
      reset();
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
            {selected ? selected.name : t("subtitle")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="flex flex-col gap-[16px]"
          >
            {/* Move-type cards. */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASS}>{t("labels.moveType")}</span>
              <div className="grid grid-cols-3 gap-2">
                {KIND_CARDS.map((card) => {
                  const active = card.kind === kind;
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.kind}
                      type="button"
                      data-testid={`supply-kind-${card.kind}`}
                      onClick={() => setKind(card.kind)}
                      className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[8px] px-2 py-3 text-center"
                      style={{
                        border: active ? "1.5px solid var(--brand-inv)" : "1px solid var(--orion-line)",
                        background: active
                          ? "color-mix(in oklab, var(--brand-inv) 10%, var(--orion-surface))"
                          : "var(--orion-surface)",
                        color: active ? "var(--orion-ink)" : "var(--orion-ink-2)",
                      }}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.8}
                        style={{ color: card.credit ? "var(--brand-inv)" : "var(--status-err)" }}
                      />
                      <span className="text-[12px]" style={{ fontWeight: active ? 500 : 400 }}>
                        {tKinds(card.kind)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Supply picker — hidden when a supply was passed in. */}
            {supply ? null : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-supply`} className={FIELD_LABEL_CLASS}>
                  {t("labels.supply")}
                </label>
                <div className="flex items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px]">
                  <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
                  <Input
                    id={`${formId}-supply`}
                    placeholder={t("placeholders.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-auto border-0 bg-transparent p-0 text-[12.5px] shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="max-h-[160px] overflow-y-auto rounded-[6px] border border-[color:var(--orion-line)]">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-[color:var(--orion-ink-3)]">{t("noSupplies")}</p>
                  ) : (
                    filtered.map((l) => {
                      const active = l.supply_id === supplyId;
                      return (
                        <button
                          key={l.supply_id}
                          type="button"
                          data-testid={`supply-option-${l.supply_id}`}
                          onClick={() => setSupplyId(l.supply_id)}
                          className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors hover:bg-[color:var(--orion-bg)]"
                          style={{
                            background: active ? "color-mix(in oklab, var(--brand-inv) 10%, transparent)" : undefined,
                          }}
                        >
                          <span className="text-[color:var(--orion-ink)]">{l.name}</span>
                          <span className="font-variant-numeric tabular-nums text-[color:var(--orion-ink-3)]">
                            {trim(num(l.on_hand))} {l.unit}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Quantity. */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-quantity`} className={FIELD_LABEL_CLASS}>
                {t("labels.quantity")}
              </label>
              <NumberInput
                id={`${formId}-quantity`}
                tone="inv"
                step={1}
                min={0}
                decimals={3}
                suffix={selected?.unit}
                placeholder="0"
                value={quantity}
                onChange={setQuantity}
              />
            </div>

            {/* Before/after preview. */}
            {selected ? (
              <div
                className="rounded-[8px] border px-3 py-2.5"
                style={{ borderColor: "var(--orion-line)", background: "var(--orion-bg)" }}
              >
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[color:var(--orion-ink-3)]">{t("preview.current")}</span>
                  <span className="font-variant-numeric tabular-nums text-[color:var(--orion-ink-2)]">
                    {trim(currentOnHand)} {selected.unit}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[12px]">
                  <span className="text-[color:var(--orion-ink-3)]">
                    {credit ? t("preview.entry") : t("preview.exit")}
                  </span>
                  <span
                    className="font-variant-numeric tabular-nums"
                    style={{ color: credit ? "var(--brand-inv)" : "var(--status-err)" }}
                  >
                    {credit ? "+" : "−"}
                    {trim(qty)} {selected.unit}
                  </span>
                </div>
                <div
                  className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-[12.5px] font-medium"
                  style={{ borderColor: "var(--orion-line-soft)" }}
                >
                  <span className="text-[color:var(--orion-ink)]">{t("preview.final")}</span>
                  <span
                    data-testid="supply-preview-final"
                    className="font-variant-numeric tabular-nums"
                    style={{ color: wouldGoNegative ? "var(--status-err)" : "var(--orion-ink)" }}
                  >
                    {trim(finalOnHand)} {selected.unit}
                  </span>
                </div>
                {wouldGoNegative ? (
                  <p className="mt-1.5 text-[11.5px] text-[color:var(--status-err)]">
                    {t("preview.negativeWarning")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Notes. */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-notes`} className={FIELD_LABEL_CLASS}>
                {t("labels.notes")}
              </label>
              <Input
                id={`${formId}-notes`}
                autoComplete="off"
                placeholder={t("placeholders.notes")}
                className={FIELD_INPUT_CLASS}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </form>
        </div>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMovement.isPending}
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={!canSubmit}
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:opacity-50"
            style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
          >
            <Check size={13} strokeWidth={2.2} />
            {t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
