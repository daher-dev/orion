"use client";

import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { NumberInput } from "@/components/ui/number-input";
import { useCreateSupply, useDeleteSupply, useUpdateSupply } from "@/hooks/use-supplies";
import {
  supplyFormSchema,
  type Supply,
  type SupplyFormPayload,
  type SupplyFormValues,
} from "@/lib/schemas/supply";

export type SupplyFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Supply;
};

const DELETE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

function toDefaults(supply?: Supply): Partial<SupplyFormValues> | undefined {
  if (!supply) return undefined;
  return {
    name: supply.name,
    unit: supply.unit,
    unit_cost: supply.unit_cost,
    min_stock: supply.min_stock ?? "",
    notes: supply.notes ?? "",
  };
}

export function SupplyFormSheet({ open, onOpenChange, initial }: SupplyFormSheetProps) {
  const t = useTranslations("supplies.form");
  const tActions = useTranslations("supplies.actions");
  const tToast = useTranslations("supplies.toast");
  const formId = useId();
  const isEdit = !!initial;
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply();
  const deleteSupply = useDeleteSupply();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPending = createSupply.isPending || updateSupply.isPending || deleteSupply.isPending;

  const defaults = toDefaults(initial);
  const form = useForm<SupplyFormValues, unknown, SupplyFormPayload>({
    resolver: zodResolver(supplyFormSchema),
    // Remount via `key` on the sheet keeps defaults fresh between edits.
    defaultValues: {
      name: defaults?.name ?? "",
      unit: defaults?.unit ?? "",
      unit_cost: defaults?.unit_cost ?? "",
      min_stock: defaults?.min_stock ?? "",
      notes: defaults?.notes ?? "",
    },
  });
  const errors = form.formState.errors;

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(`validation.${key.replace("validation.", "")}` as never);
  }

  const handleSubmit = async (values: SupplyFormPayload) => {
    const payload = {
      name: values.name,
      unit: values.unit,
      unit_cost: values.unit_cost,
      min_stock: values.min_stock ? values.min_stock : null,
      notes: values.notes ? values.notes : null,
    };
    try {
      if (isEdit && initial) {
        await updateSupply.mutateAsync({ id: initial.id, payload });
        toast.success(tToast("updated"));
      } else {
        await createSupply.mutateAsync(payload);
        toast.success(tToast("created"));
      }
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(tToast("error"), detail ? { description: detail } : undefined);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !initial) return;
    try {
      await deleteSupply.mutateAsync(initial.id);
      toast.success(tToast("deleted"));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(tToast("error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {isEdit && initial ? initial.name : t("title.new")}
          </SheetTitle>
          {isEdit && initial ? (
            <SheetDescription
              className="font-mono text-[12px] text-[color:var(--orion-ink-3)]"
              data-testid="supply-sheet-id"
            >
              {initial.id}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{t("title.new")}</SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          <form id={formId} onSubmit={form.handleSubmit(handleSubmit)} noValidate className="flex flex-col gap-[14px]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-name`} className={FIELD_LABEL_CLASS}>
                {t("labels.name")}
              </label>
              <Input
                id={`${formId}-name`}
                autoComplete="off"
                placeholder={t("placeholders.name")}
                className={FIELD_INPUT_CLASS}
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              {errors.name?.message ? (
                <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                  {translateError(errors.name.message as string)}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-[14px]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-unit`} className={FIELD_LABEL_CLASS}>
                  {t("labels.unit")}
                </label>
                <Input
                  id={`${formId}-unit`}
                  autoComplete="off"
                  placeholder={t("placeholders.unit")}
                  className={FIELD_INPUT_CLASS}
                  aria-invalid={!!errors.unit}
                  {...form.register("unit")}
                />
                {errors.unit?.message ? (
                  <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                    {translateError(errors.unit.message as string)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${formId}-unit_cost`} className={FIELD_LABEL_CLASS}>
                  {t("labels.unitCost")}
                </label>
                <Controller
                  control={form.control}
                  name="unit_cost"
                  render={({ field }) => (
                    <NumberInput
                      id={`${formId}-unit_cost`}
                      tone="inv"
                      step={0.5}
                      min={0}
                      decimals={2}
                      prefix="R$"
                      placeholder={t("placeholders.unitCost")}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={!!errors.unit_cost}
                    />
                  )}
                />
                {errors.unit_cost?.message ? (
                  <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                    {translateError(errors.unit_cost.message as string)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-min_stock`} className={FIELD_LABEL_CLASS}>
                {t("labels.minStock")}
              </label>
              <Controller
                control={form.control}
                name="min_stock"
                render={({ field }) => (
                  <NumberInput
                    id={`${formId}-min_stock`}
                    tone="inv"
                    step={1}
                    min={0}
                    decimals={3}
                    placeholder={t("placeholders.minStock")}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!errors.min_stock}
                  />
                )}
              />
              <p className="text-[11px] text-[color:var(--orion-ink-3)]">{t("hints.minStock")}</p>
              {errors.min_stock?.message ? (
                <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                  {translateError(errors.min_stock.message as string)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${formId}-notes`} className={FIELD_LABEL_CLASS}>
                {t("labels.notes")}
              </label>
              <Textarea
                id={`${formId}-notes`}
                rows={3}
                placeholder={t("placeholders.notes")}
                className={FIELD_INPUT_CLASS}
                {...form.register("notes")}
              />
            </div>
          </form>
        </div>

        <SheetFooter className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px] sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="ghost"
              className={DELETE_BUTTON_CLASS}
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {tActions("delete")}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex items-center gap-2">
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
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
            >
              <Check size={13} strokeWidth={2.2} />
              {isEdit ? t("save") : t("submitNew")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tActions("delete")}</AlertDialogTitle>
            <AlertDialogDescription>{tActions("confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSupply.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSupply.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {tActions("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
