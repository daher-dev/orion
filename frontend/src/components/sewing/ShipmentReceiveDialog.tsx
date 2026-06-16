"use client";

import { useEffect } from "react";
import { Check, PackageCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { NumberInput } from "@/components/ui/number-input";
import { useReceiveShipment } from "@/hooks/use-sewing";
import { ApiError } from "@/lib/api-client";
import {
  buildShipmentReceivePayload,
  shipmentReceiveFormSchema,
  type Shipment,
  type ShipmentReceiveFormParsed,
  type ShipmentReceiveFormValues,
} from "@/lib/schemas/sewing";
import { SIZES, type Size } from "@/lib/schemas/product";

type Props = {
  open: boolean;
  shipment: Shipment | null;
  onOpenChange: (open: boolean) => void;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ZERO_SIZES: Record<Size, number> = { p: 0, m: 0, g: 0, gg: 0, u: 0 };

/** Map item.<field> by size into a fully-populated size record. */
function bySize(
  shipment: Shipment | null,
  field: "requested_quantity" | "received_quantity" | "credited_quantity",
): Record<Size, number> {
  const out: Record<Size, number> = { ...ZERO_SIZES };
  for (const it of shipment?.items ?? []) out[it.size] = it[field];
  return out;
}

/**
 * Partial, repeatable receive sheet — port of the prototype's
 * planned/received/credited grid (production.jsx `SewingDetail`) + the
 * delta-credit logic in `postReceive`. Per size it shows three columns:
 *   Enviado (requested) · Recebido (editable, defaults to current received so
 *   re-receives top up) · Creditado (read-only watermark already posted to
 *   blank stock). The backend credits only the delta (received − credited);
 *   we surface that delta as a hint. Inputs are capped at `requested`.
 */
export function ShipmentReceiveDialog({ open, shipment, onOpenChange }: Props) {
  const t = useTranslations("sewing");
  const receive = useReceiveShipment();

  const requestedBySize = bySize(shipment, "requested_quantity");
  const receivedBySize = bySize(shipment, "received_quantity");
  const creditedBySize = bySize(shipment, "credited_quantity");

  const form = useForm<ShipmentReceiveFormValues, unknown, ShipmentReceiveFormParsed>({
    resolver: zodResolver(shipmentReceiveFormSchema),
    defaultValues: {
      received_at: todayIso(),
      // Default to the CURRENT received counts so a re-receive only edits the
      // sizes that changed (the delta is computed server-side).
      sizes: receivedBySize,
    },
  });

  useEffect(() => {
    if (open && shipment) {
      form.reset({
        received_at: todayIso(),
        sizes: bySize(shipment, "received_quantity"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shipment]);

  const errors = form.formState.errors;
  const watchedSizes = form.watch("sizes");

  async function onSubmit(parsed: ShipmentReceiveFormParsed) {
    if (!shipment) return;
    try {
      await receive.mutateAsync({
        id: shipment.id,
        payload: buildShipmentReceivePayload(parsed),
      });
      toast.success(t("form.toasts.received"));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(t("form.toasts.error"), { description: err.detail });
        return;
      }
      toast.error(t("form.toasts.error"));
    }
  }

  // Sizes shown in the grid: only those the shipment actually carries.
  const sizesInUse = SIZES.filter((s) => requestedBySize[s] > 0);

  // Total delta about to be credited = Σ max(0, received − credited).
  const totalDelta = sizesInUse.reduce((acc, s) => {
    const received = Number(watchedSizes?.[s]) || 0;
    return acc + Math.max(0, received - creditedBySize[s]);
  }, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[520px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="flex items-center gap-2 font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            <PackageCheck size={16} strokeWidth={1.8} className="text-[color:var(--brand-prod)]" />
            {t("receive.title")}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
            {t("receive.description")}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-col gap-4 px-[22px] py-[18px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="receive-received_at" className={FIELD_LABEL_CLASS}>
                {t("receive.labels.receivedAt")}
              </label>
              <Controller
                control={form.control}
                name="received_at"
                render={({ field }) => (
                  <Input
                    id="receive-received_at"
                    type="date"
                    className={FIELD_INPUT_CLASS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.received_at?.message ? (
                <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                  {t(`form.${errors.received_at.message}` as never)}
                </p>
              ) : null}
            </div>

            {/* planned / received / credited grid */}
            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASS}>{t("receive.labels.sizes")}</span>
              <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                {/* Header row */}
                <div
                  className="grid items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]"
                  style={{ gridTemplateColumns: "44px 1fr 1fr 1fr" }}
                >
                  <span>{t("receive.columns.size")}</span>
                  <span className="text-right">{t("receive.columns.sent")}</span>
                  <span className="text-right">{t("receive.columns.received")}</span>
                  <span className="text-right">{t("receive.columns.credited")}</span>
                </div>
                {sizesInUse.map((size, i) => {
                  const requested = requestedBySize[size];
                  const credited = creditedBySize[size];
                  return (
                    <div
                      key={size}
                      className="grid items-center gap-2 px-3 py-2.5"
                      style={{
                        gridTemplateColumns: "44px 1fr 1fr 1fr",
                        borderBottom:
                          i < sizesInUse.length - 1 ? "1px solid var(--orion-line-soft)" : "none",
                      }}
                    >
                      <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
                        {size.toUpperCase()}
                      </span>
                      <span
                        className="text-right text-[13px] text-[color:var(--orion-ink-2)] tabular-nums"
                        data-testid={`receive-sent-${size}`}
                      >
                        {requested}
                      </span>
                      <div className="flex justify-end">
                        <Controller
                          control={form.control}
                          name={`sizes.${size}` as const}
                          render={({ field }) => (
                            <NumberInput
                              tone="prod"
                              step={1}
                              min={0}
                              max={requested}
                              decimals={0}
                              align="center"
                              aria-label={`${size.toUpperCase()} ${t("receive.columns.received")}`}
                              data-testid={`receive-size-${size}`}
                              value={field.value as number | string | null | undefined}
                              onChange={(next) => field.onChange(next === "" ? 0 : Number(next))}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                      </div>
                      <span
                        className="text-right text-[13px] text-[color:var(--orion-ink-3)] tabular-nums"
                        data-testid={`receive-credited-${size}`}
                      >
                        {credited}
                      </span>
                    </div>
                  );
                })}
              </div>
              {errors.sizes?.p?.message ? (
                <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                  {t(`form.${errors.sizes.p.message}` as never)}
                </p>
              ) : null}
            </div>

            {/* Delta hint — how many blank pieces this receive will credit. */}
            <div
              data-testid="receive-delta-hint"
              className="flex items-center gap-2 rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3 py-2.5 text-[12px] text-[color:var(--orion-ink-2)]"
            >
              <PackageCheck size={13} className="text-[color:var(--brand-prod)]" />
              <span>{t("receive.deltaHint", { count: totalDelta })}</span>
            </div>
          </div>

          <SheetFooter className="mt-auto border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
            <Button
              type="button"
              variant="ghost"
              className="h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
              onClick={() => onOpenChange(false)}
              disabled={receive.isPending}
            >
              {t("form.cancel")}
            </Button>
            <Button
              type="submit"
              data-testid="receive-submit"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]"
              style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
              disabled={receive.isPending}
            >
              <Check size={13} strokeWidth={2.2} />
              {t("actions.confirmReceive")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
