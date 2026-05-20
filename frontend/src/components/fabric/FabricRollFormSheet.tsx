"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
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
import { FabricRollForm } from "@/components/fabric/FabricRollForm";
import {
  useCreateFabricRoll,
  useUpdateFabricRoll,
} from "@/hooks/use-fabric";
import type {
  FabricRoll,
  FabricRollFormPayload,
  FabricRollFormValues,
} from "@/lib/schemas/fabric";

export type FabricRollFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: FabricRoll;
};

function toDefaults(roll?: FabricRoll): Partial<FabricRollFormValues> | undefined {
  if (!roll) return undefined;
  return {
    received_at: roll.received_at.slice(0, 10),
    supplier_name: roll.supplier_name,
    kind: roll.kind,
    fabric_type: roll.fabric_type,
    color: roll.color,
    initial_weight_kg: roll.initial_weight_kg,
    current_weight_kg: roll.current_weight_kg,
    price_per_kg: roll.price_per_kg,
  };
}

export function FabricRollFormSheet({ open, onOpenChange, initial }: FabricRollFormSheetProps) {
  const t = useTranslations("fabric.form");
  const tTypes = useTranslations("fabric.fabricTypes");
  const formId = useId();
  const isEdit = !!initial;
  const createRoll = useCreateFabricRoll();
  const updateRoll = useUpdateFabricRoll();
  const isPending = createRoll.isPending || updateRoll.isPending;

  const handleSubmit = async (values: FabricRollFormPayload) => {
    try {
      if (isEdit && initial) {
        await updateRoll.mutateAsync({ id: initial.id, payload: values });
        toast.success(t("toasts.updated"));
      } else {
        await createRoll.mutateAsync(values);
        toast.success(t("toasts.created"));
      }
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
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
            {isEdit && initial ? tTypes(initial.fabric_type) : t("title.new")}
          </SheetTitle>
          {/* Sub-line per design — short mono ID + supplier/color summary.
              For new-fabric we keep the sub-description hidden for sr only. */}
          {isEdit && initial ? (
            <SheetDescription
              className="font-mono text-[12px] text-[color:var(--orion-ink-3)]"
              data-testid="fabric-sheet-id"
            >
              {initial.id}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              {t("title.new")}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          <FabricRollForm
            formId={formId}
            defaultValues={toDefaults(initial)}
            onSubmit={handleSubmit}
          />
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
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
            style={{
              borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)",
            }}
          >
            <Check size={13} strokeWidth={2.2} />
            {isEdit ? t("save") : t("submitNew")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
