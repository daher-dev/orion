"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QtySpinner } from "@/components/inventory/QtySpinner";
import { ApiError } from "@/lib/api-client";
import { useCreateFabricMovement } from "@/hooks/use-fabric";
import { type FabricMovementKind, type FabricRoll } from "@/lib/schemas/fabric";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The roll list (already loaded by the page) to pick a target from. */
  rolls: FabricRoll[];
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

function fabricRollCode(id: string): string {
  return `BB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

type MoveType = {
  id: FabricMovementKind;
  dir: "+" | "-";
  icon: typeof ArrowDown;
};

const MOVE_TYPES: readonly MoveType[] = [
  { id: "entry", dir: "+", icon: ArrowDown },
  { id: "exit", dir: "-", icon: ArrowUp },
  { id: "adjustment", dir: "+", icon: SlidersHorizontal },
];

/**
 * Manual movement sheet for fabric rolls — metered sibling of the counted
 * `UnitMoveSheet`. Captures a target roll + kind (entrada/saída/ajuste) + a
 * kg quantity, previews `current ± move = final` (clamped at 0 for exits), and
 * POSTs via `useCreateFabricMovement`. Cutting-driven exits are written
 * automatically by the backend on DONE and are NOT created here.
 */
export function FabricMoveSheet({ open, onOpenChange, rolls }: Props) {
  const t = useTranslations("fabric.movements");
  const tTypes = useTranslations("fabric.fabricTypes");
  const format = useFormatter();
  const createMovement = useCreateFabricMovement();

  const [rollId, setRollId] = useState("");
  const [rollOpen, setRollOpen] = useState(false);
  const [kind, setKind] = useState<FabricMovementKind>("entry");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the sheet opens.
  const resetKey = open ? "1" : "0";
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setRollId("");
    setKind("entry");
    setQuantity("1");
    setError(null);
  }

  const selectedRoll = useMemo(() => rolls.find((r) => r.id === rollId), [rollId, rolls]);
  const moveType = MOVE_TYPES.find((m) => m.id === kind) ?? MOVE_TYPES[0];
  const qty = Number(quantity.replace(",", ".")) || 0;
  const current = selectedRoll ? Number(selectedRoll.current_weight_kg) || 0 : 0;
  const delta = moveType.dir === "+" ? qty : -qty;
  const projected = Math.max(0, current + delta);

  async function handleSubmit() {
    if (!selectedRoll) {
      setError(t("validation.rollRequired"));
      return;
    }
    if (!(qty > 0)) {
      setError(t("validation.quantityPositive"));
      return;
    }
    setError(null);
    try {
      await createMovement.mutateAsync({
        fabric_roll_id: selectedRoll.id,
        kind,
        quantity: String(qty),
      });
      toast.success(t("toasts.recorded"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="fabric-move-sheet"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("moveSheet.title")}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
            {t("moveSheet.sub")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[18px]">
          {/* Roll picker */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("moveSheet.labels.roll")}</span>
            <Popover open={rollOpen} onOpenChange={setRollOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  data-testid="fabric-move-roll-trigger"
                  aria-expanded={rollOpen}
                  className={cn("h-auto w-full justify-between gap-2 font-normal", FIELD_INPUT_CLASS)}
                >
                  {selectedRoll ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                        {fabricRollCode(selectedRoll.id)}
                      </span>
                      <span className="truncate text-[12px] text-[color:var(--orion-ink-3)]">
                        {tTypes(selectedRoll.fabric_type)} · {selectedRoll.color}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("moveSheet.placeholders.roll")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      rollOpen && "rotate-180",
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("moveSheet.placeholders.searchRoll")} />
                  <CommandList>
                    <CommandEmpty>{t("moveSheet.noRolls")}</CommandEmpty>
                    <CommandGroup>
                      {rolls.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`${r.fabric_type} ${r.color} ${r.supplier_name}`}
                          onSelect={() => {
                            setRollId(r.id);
                            setRollOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn("mr-2", rollId === r.id ? "opacity-100" : "opacity-0")}
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                              {fabricRollCode(r.id)} · {tTypes(r.fabric_type)}
                            </span>
                            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                              {r.color} · {r.current_weight_kg}kg
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Move-type tiles */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("moveSheet.labels.moveType")}</span>
            <div className="grid grid-cols-3 gap-2">
              {MOVE_TYPES.map((m) => {
                const active = m.id === kind;
                const tone = m.dir === "+" ? "var(--status-ok)" : "var(--status-err)";
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`fabric-movetype-${m.id}`}
                    data-active={active || undefined}
                    onClick={() => setKind(m.id)}
                    className="flex flex-col items-center gap-1.5 rounded-[10px] border bg-[color:var(--orion-surface)] px-2 py-3 text-center transition-colors hover:bg-[color:var(--orion-surface-2)]"
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
                      className="grid size-8 place-items-center rounded-[8px]"
                      style={{
                        background: `color-mix(in oklab, ${tone} 14%, var(--orion-surface))`,
                        color: tone,
                      }}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <span
                      className="text-[12px] text-[color:var(--orion-ink)]"
                      style={{ fontWeight: active ? 600 : 500 }}
                    >
                      {t(`moveSheet.moveTypes.${m.id}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("moveSheet.labels.quantity")}</span>
            <QtySpinner
              value={quantity}
              onChange={(next) => {
                setQuantity(next);
                setError(null);
              }}
              decimal
              suffix="kg"
              testId="fabric-move-quantity"
            />
          </div>

          {/* Preview: current ± move = final */}
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("moveSheet.labels.preview")}</span>
            <div
              className="grid items-center gap-2 rounded-[12px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3 py-3"
              style={{ gridTemplateColumns: "1fr auto 1fr auto 1fr" }}
              data-testid="fabric-move-preview"
            >
              <div className="text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {t("moveSheet.preview.current")}
                </div>
                <div className="font-serif text-[26px] leading-[1.1] text-[color:var(--orion-ink)] tabular-nums">
                  {format.number(current, { maximumFractionDigits: 1 })}
                </div>
              </div>
              <span className="font-serif text-[22px] text-[color:var(--orion-ink-3)]">
                {moveType.dir === "+" ? "+" : "−"}
              </span>
              <div className="text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {moveType.dir === "+" ? t("moveSheet.preview.entry") : t("moveSheet.preview.exit")}
                </div>
                <div
                  className="font-serif text-[26px] leading-[1.1] tabular-nums"
                  style={{ color: moveType.dir === "+" ? "var(--status-ok)" : "var(--status-err)" }}
                >
                  {format.number(qty, { maximumFractionDigits: 1 })}
                </div>
              </div>
              <span className="font-serif text-[22px] text-[color:var(--orion-ink-3)]">=</span>
              <div className="text-center">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {t("moveSheet.preview.final")}
                </div>
                <div
                  className="font-serif text-[26px] leading-[1.1] text-[color:var(--orion-ink)] tabular-nums"
                  data-testid="fabric-move-preview-final"
                >
                  {format.number(projected, { maximumFractionDigits: 1 })}
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <p role="alert" data-testid="fabric-move-error" className="text-[11.5px] text-[color:var(--status-err)]">
              {error}
            </p>
          ) : null}
        </div>

        <SheetFooter className="mt-auto border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMovement.isPending}
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("moveSheet.cancel")}
          </Button>
          <Button
            type="button"
            data-testid="fabric-move-submit"
            onClick={() => void handleSubmit()}
            disabled={createMovement.isPending}
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
          >
            <Check size={13} />
            {t("moveSheet.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
