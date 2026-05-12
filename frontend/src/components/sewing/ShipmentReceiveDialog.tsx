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
import { cn } from "@/lib/utils";

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

export function ShipmentReceiveDialog({ open, shipment, onOpenChange }: Props) {
  const t = useTranslations("sewing");
  const receive = useReceiveShipment();

  const requestedBySize = shipment
    ? shipment.items.reduce<Record<Size, number>>(
        (acc, it) => {
          acc[it.size] = it.requested_quantity;
          return acc;
        },
        { p: 0, m: 0, g: 0, gg: 0 },
      )
    : { p: 0, m: 0, g: 0, gg: 0 };

  const form = useForm<ShipmentReceiveFormValues, unknown, ShipmentReceiveFormParsed>({
    resolver: zodResolver(shipmentReceiveFormSchema),
    defaultValues: {
      received_at: todayIso(),
      sizes: requestedBySize,
    },
  });

  useEffect(() => {
    if (open && shipment) {
      form.reset({
        received_at: todayIso(),
        sizes: shipment.items.reduce<Record<Size, number>>(
          (acc, it) => {
            acc[it.size] = it.requested_quantity;
            return acc;
          },
          { p: 0, m: 0, g: 0, gg: 0 },
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shipment]);

  const errors = form.formState.errors;

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="flex items-center gap-2 font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            <PackageCheck
              size={16}
              strokeWidth={1.8}
              className="text-[color:var(--brand-prod)]"
            />
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

            <div className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL_CLASS}>{t("receive.labels.sizes")}</span>
              <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                <div className="grid grid-cols-4 gap-px bg-[color:var(--orion-line-soft)]">
                  {SIZES.map((size) => (
                    <div
                      key={size}
                      className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
                    >
                      <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
                        {size.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[color:var(--orion-ink-3)]">
                        / {requestedBySize[size]}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={requestedBySize[size]}
                        inputMode="numeric"
                        className={cn(FIELD_INPUT_CLASS, "h-auto w-full max-w-[68px] text-center")}
                        {...form.register(`sizes.${size}` as const, { valueAsNumber: true })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {errors.sizes?.p?.message ? (
                <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                  {t(`form.${errors.sizes.p.message}` as never)}
                </p>
              ) : null}
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
