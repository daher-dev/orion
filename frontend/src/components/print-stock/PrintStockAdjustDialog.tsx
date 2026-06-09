"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { usePrints } from "@/hooks/use-prints";
import { useCreatePrintStockEntry, useCreatePrintStockExit } from "@/hooks/use-print-stock";
import type { PrintStockLevelRead } from "@/lib/schemas/print-stock";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the estampa + colour when opened from a levels row. */
  level: PrintStockLevelRead | null;
};

type Direction = "entry" | "exit";

const FIELD_LABEL_CLASS =
  "mb-1.5 block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

/**
 * The form body. Lives in its own component so the parent can remount it with a
 * `key` whenever the dialog opens — fields then initialise from props via
 * `useState` initialisers (no reset effect, avoiding cascading-render lint).
 */
function AdjustForm({ level, onClose }: { level: PrintStockLevelRead | null; onClose: () => void }) {
  const t = useTranslations("printStock.adjust");
  const tv = useTranslations("printStock.validation");

  const [direction, setDirection] = useState<Direction>("entry");
  const [designId, setDesignId] = useState(level?.print_design_id ?? "");
  const [color, setColor] = useState(level?.product_color ?? "");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: printsPage } = usePrints({ page_size: 100 });
  const designs = useMemo(() => printsPage?.items ?? [], [printsPage]);

  const createEntry = useCreatePrintStockEntry();
  const createExit = useCreatePrintStockExit();
  const pending = createEntry.isPending || createExit.isPending;

  async function handleSubmit() {
    setError(null);
    if (!designId) {
      setError(tv("designRequired"));
      return;
    }
    const trimmedColor = color.trim();
    if (!trimmedColor) {
      setError(tv("colorRequired"));
      return;
    }
    const qty = Number(quantity);
    if (!/^\d+$/.test(quantity.trim()) || qty <= 0) {
      setError(tv("quantityPositive"));
      return;
    }

    const payload = {
      print_design_id: designId,
      product_color: trimmedColor,
      quantity: qty,
      notes: notes.trim() || null,
    };

    try {
      if (direction === "entry") {
        await createEntry.mutateAsync(payload);
      } else {
        await createExit.mutateAsync(payload);
      }
      toast.success(t("toasts.success"));
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t("toasts.insufficient"));
        return;
      }
      const message = err instanceof Error ? err.message : t("toasts.error");
      setError(message);
      toast.error(t("toasts.error"));
    }
  }

  return (
    <>
      <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
        <SheetTitle className="font-serif text-[18px] font-medium text-[color:var(--orion-ink)]">
          {t("title")}
        </SheetTitle>
        <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("sub")}</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto px-[22px] py-[18px]">
        {/* Direction toggle */}
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("fields.direction")}</span>
          <div className="grid grid-cols-2 gap-2">
            {(["entry", "exit"] as Direction[]).map((d) => {
              const active = direction === d;
              const Icon = d === "entry" ? ArrowDown : ArrowUp;
              return (
                <button
                  key={d}
                  type="button"
                  data-testid={`print-adjust-direction-${d}`}
                  onClick={() => setDirection(d)}
                  className="flex items-center justify-center gap-1.5 rounded-[8px] border px-3 py-2 text-[13px] font-medium transition-colors"
                  style={{
                    borderColor: active ? "var(--brand-inv)" : "var(--orion-line)",
                    background: active
                      ? "color-mix(in oklab, var(--brand-inv) 10%, var(--orion-surface))"
                      : "var(--orion-bg)",
                    color: active ? "var(--brand-inv)" : "var(--orion-ink-2)",
                  }}
                >
                  <Icon size={14} strokeWidth={2} />
                  {t(`directions.${d}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Estampa picker */}
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("fields.design")}</span>
          <Select value={designId} onValueChange={setDesignId}>
            <SelectTrigger data-testid="print-adjust-design" className={FIELD_INPUT_CLASS}>
              <SelectValue placeholder={t("fields.designPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {designs.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product colour */}
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("fields.color")}</span>
          <Input
            data-testid="print-adjust-color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder={t("fields.colorPlaceholder")}
            maxLength={80}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        {/* Quantity */}
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("fields.quantity")}</span>
          <Input
            data-testid="print-adjust-quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="0"
            className={FIELD_INPUT_CLASS}
          />
        </div>

        {/* Notes */}
        <div>
          <span className={FIELD_LABEL_CLASS}>{t("fields.notes")}</span>
          <Textarea
            data-testid="print-adjust-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={t("fields.notesPlaceholder")}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        {error ? (
          <p data-testid="print-adjust-error" className="text-[12.5px] text-[color:var(--status-err)]">
            {error}
          </p>
        ) : null}
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
        >
          {t("actions.cancel")}
        </Button>
        <Button
          type="button"
          data-testid="print-adjust-submit"
          disabled={pending}
          onClick={handleSubmit}
          className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
        >
          {t("actions.confirm")}
        </Button>
      </SheetFooter>
    </>
  );
}

/**
 * Manual entry/exit recorder for printed-stamp stock. A direction toggle picks
 * the mutation; the estampa picker + free-text colour identify the ledger key.
 * Mirrors the Stock adjust drawer but for the simpler print-stock model
 * (no reason/source dimension).
 */
export function PrintStockAdjustDialog({ open, onOpenChange, level }: Props) {
  // Remount the form whenever the dialog opens (and per selected level) so its
  // fields re-initialise from props without a reset effect.
  const formKey = `${open ? "open" : "closed"}:${level?.print_design_id ?? "new"}:${level?.product_color ?? ""}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="print-stock-adjust-dialog"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 sm:max-w-[460px]"
      >
        {open ? <AdjustForm key={formKey} level={level} onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}
