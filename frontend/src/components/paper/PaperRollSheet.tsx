"use client";

import { useState } from "react";
import { Calendar, Check, Printer, Ruler, Scroll, Trash2, Truck, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QtySpinner } from "@/components/inventory/QtySpinner";
import { ApiError } from "@/lib/api-client";
import {
  useConsumePaperRoll,
  useCreatePaperRoll,
  useDeletePaperRoll,
} from "@/hooks/use-paper-rolls";
import { PAPER_TYPES, type PaperRoll, type PaperType } from "@/lib/schemas/paper-roll";

type Mode = { kind: "new" } | { kind: "detail"; roll: PaperRoll };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode | null;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Receive / detail+consume sheet for a paper roll — port of the prototype's
 * single `PaperRolls` Sheet (NewPaperRollForm + PaperRollDetail). In "new" mode
 * it captures material/width/meters/supplier and POSTs a roll; in "detail" mode
 * it shows the saldo bar + meta and lets the operator launch a consume (which
 * clamps at 0 server-side) or delete the roll.
 */
export function PaperRollSheet({ open, onOpenChange, mode }: Props) {
  const t = useTranslations("paperRolls");
  const tTypes = useTranslations("paperRolls.types");
  const format = useFormatter();

  const createRoll = useCreatePaperRoll();
  const consumeRoll = useConsumePaperRoll();
  const deleteRoll = useDeletePaperRoll();

  // New-roll form state.
  const [paperType, setPaperType] = useState<PaperType>("dtf_film");
  const [widthCm, setWidthCm] = useState("60");
  const [meters, setMeters] = useState("100");
  const [supplier, setSupplier] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Detail consume state.
  const [consume, setConsume] = useState("5");

  // Reset form whenever the sheet opens.
  const resetKey = `${open ? "1" : "0"}|${mode?.kind ?? "none"}`;
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPaperType("dtf_film");
    setWidthCm("60");
    setMeters("100");
    setSupplier("");
    setFormError(null);
    setConsume("5");
  }

  async function handleCreate() {
    const widthNum = Number(widthCm);
    const metersNum = Number(meters.replace(",", "."));
    if (!Number.isInteger(widthNum) || widthNum <= 0 || !(metersNum > 0)) {
      setFormError(t("receive.validation.invalid"));
      return;
    }
    if (!supplier.trim()) {
      setFormError(t("receive.validation.supplierRequired"));
      return;
    }
    setFormError(null);
    try {
      await createRoll.mutateAsync({
        received_at: todayIso(),
        supplier_name: supplier.trim(),
        paper_type: paperType,
        width_cm: widthNum,
        initial_meters: String(metersNum),
      });
      toast.success(t("toasts.rollReceived"));
      onOpenChange(false);
    } catch {
      toast.error(t("toasts.error"));
    }
  }

  async function handleConsume(roll: PaperRoll) {
    const qty = Number(consume.replace(",", "."));
    if (!(qty > 0)) return;
    try {
      await consumeRoll.mutateAsync({ id: roll.id, payload: { quantity: String(qty) } });
      toast.success(t("toasts.consumed"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  async function handleDelete(roll: PaperRoll) {
    try {
      await deleteRoll.mutateAsync(roll.id);
      toast.success(t("toasts.deleted"));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t("toasts.deleteBlocked"));
        return;
      }
      toast.error(t("toasts.error"));
    }
  }

  const isNew = mode?.kind === "new";
  const roll = mode?.kind === "detail" ? mode.roll : null;

  const initial = roll ? Number(roll.initial_meters) || 0 : 0;
  const current = roll ? Number(roll.current_meters) || 0 : 0;
  const used = roll ? Number(roll.consumed_meters) || 0 : 0;
  const pct = initial > 0 ? (current / initial) * 100 : 0;
  const low = pct < 25;
  const consumeNum = Number(consume.replace(",", ".")) || 0;
  const afterConsume = Math.max(0, current - consumeNum);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="paper-roll-sheet"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {isNew ? t("receive.title") : roll ? tTypes(roll.paper_type) : ""}
          </SheetTitle>
          <SheetDescription className="text-[12.5px] text-[color:var(--orion-ink-3)]">
            {isNew ? t("receive.sub") : roll ? `${roll.width_cm} cm` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[22px] py-[18px]">
          {isNew ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>{t("receive.fields.material")}</span>
                <Select value={paperType} onValueChange={(v) => setPaperType(v as PaperType)}>
                  <SelectTrigger
                    data-testid="paper-receive-type"
                    className="h-auto gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus:ring-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {tTypes(pt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className={FIELD_LABEL_CLASS}>{t("receive.fields.width")}</span>
                  <Input
                    data-testid="paper-receive-width"
                    inputMode="numeric"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value.replace(/\D/g, ""))}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={FIELD_LABEL_CLASS}>{t("receive.fields.meters")}</span>
                  <Input
                    data-testid="paper-receive-meters"
                    inputMode="decimal"
                    value={meters}
                    onChange={(e) => setMeters(e.target.value.replace(/[^\d.,]/g, ""))}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL_CLASS}>{t("receive.fields.supplier")}</span>
                <Input
                  data-testid="paper-receive-supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder={t("receive.fields.supplierPlaceholder")}
                  className={INPUT_CLASS}
                />
              </div>
              {formError ? (
                <p role="alert" data-testid="paper-receive-error" className="text-[11.5px] text-[color:var(--status-err)]">
                  {formError}
                </p>
              ) : null}
            </>
          ) : roll ? (
            <>
              {/* Saldo card */}
              <div className="rounded-[12px] bg-[color:var(--orion-surface-2)] p-[18px]">
                <div className="mb-3.5 flex items-center gap-3">
                  <span className="grid size-10 flex-shrink-0 place-items-center rounded-[8px] bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)]">
                    <Scroll size={22} strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="font-serif text-[20px] text-[color:var(--orion-ink)]">{tTypes(roll.paper_type)}</div>
                    <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
                      {t("detail.widthLabel", { width: roll.width_cm })}
                    </div>
                  </div>
                </div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className={FIELD_LABEL_CLASS}>{t("detail.remaining")}</span>
                  <span
                    className="font-serif text-[22px] tabular-nums"
                    style={{ color: low ? "var(--status-err)" : "var(--orion-ink)" }}
                  >
                    {format.number(current, { maximumFractionDigits: 0 })}
                    <span className="ml-1 text-[12px] text-[color:var(--orion-ink-3)]">
                      / {format.number(initial, { maximumFractionDigits: 0 })} m
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--orion-surface)" }}>
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.max(0, Math.min(100, pct))}%`,
                      background: low ? "var(--status-err)" : "var(--brand-inv)",
                    }}
                  />
                </div>
                {low ? (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-[color:var(--status-err)]">
                    <AlertTriangle size={11} /> {t("detail.lowWarning")}
                  </p>
                ) : null}
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2">
                <MetaCell icon={<Truck size={13} />} label={t("detail.supplier")}>{roll.supplier_name}</MetaCell>
                <MetaCell icon={<Calendar size={13} />} label={t("detail.received")}>
                  {format.dateTime(new Date(roll.received_at), { day: "2-digit", month: "2-digit", year: "numeric" })}
                </MetaCell>
                <MetaCell icon={<Printer size={13} />} label={t("detail.consumed")}>
                  {format.number(used, { maximumFractionDigits: 0 })} m
                </MetaCell>
                <MetaCell icon={<Ruler size={13} />} label={t("detail.width")}>{roll.width_cm} cm</MetaCell>
              </div>

              {/* Launch consume */}
              <div className="border-t border-[color:var(--orion-line-soft)] pt-3.5">
                <span className={FIELD_LABEL_CLASS}>{t("detail.consumeTitle")}</span>
                <div className="mt-1.5">
                  <QtySpinner value={consume} onChange={setConsume} decimal suffix="m" testId="paper-consume-quantity" />
                </div>
                <p className="mt-1.5 text-[11px] text-[color:var(--orion-ink-3)]">
                  {t("detail.afterConsume")}{" "}
                  <b style={{ color: afterConsume < initial * 0.25 ? "var(--status-err)" : "var(--orion-ink)" }}>
                    {format.number(afterConsume, { maximumFractionDigits: 0 })} m
                  </b>
                </p>
              </div>
            </>
          ) : null}
        </div>

        <SheetFooter className="mt-auto border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          {isNew ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createRoll.isPending}
                className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
              >
                {t("receive.cancel")}
              </Button>
              <Button
                type="button"
                data-testid="paper-receive-submit"
                onClick={() => void handleCreate()}
                disabled={createRoll.isPending}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
              >
                <Check size={13} />
                {t("receive.submit")}
              </Button>
            </>
          ) : roll ? (
            <>
              <Button
                type="button"
                variant="ghost"
                data-testid="paper-delete"
                onClick={() => void handleDelete(roll)}
                disabled={deleteRoll.isPending || consumeRoll.isPending}
                className="mr-auto h-auto gap-[7px] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] hover:bg-[color:var(--status-err-bg)]"
              >
                <Trash2 size={13} />
                {t("detail.delete")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={consumeRoll.isPending}
                className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
              >
                {t("detail.close")}
              </Button>
              <Button
                type="button"
                data-testid="paper-consume-submit"
                onClick={() => void handleConsume(roll)}
                disabled={consumeRoll.isPending || consumeNum <= 0}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
              >
                <Printer size={13} />
                {t("detail.consumeSubmit")}
              </Button>
            </>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MetaCell({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[color:var(--orion-ink)]">{children}</div>
    </div>
  );
}
