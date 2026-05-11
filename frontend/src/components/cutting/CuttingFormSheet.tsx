"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
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
import { useCreateCuttingOrder } from "@/hooks/use-cutting";
import {
  buildCuttingCreatePayload,
  type CuttingFormParsed,
} from "@/lib/schemas/cutting";
import { ApiError } from "@/lib/api-client";
import { CuttingForm } from "./CuttingForm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const CANCEL_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]";

export function CuttingFormSheet({ open, onOpenChange }: Props) {
  const t = useTranslations("cutting");
  const formId = useId();
  const create = useCreateCuttingOrder();
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(parsed: CuttingFormParsed) {
    setServerError(null);
    const payload = buildCuttingCreatePayload(parsed);
    try {
      await create.mutateAsync(payload);
      toast.success(t("form.toasts.created"));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.detail);
        toast.error(t("form.toasts.error"), { description: err.detail });
        return;
      }
      toast.error(t("form.toasts.error"));
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setServerError(null);
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className={SHEET_CLASS} side="right">
        <SheetHeader
          className="flex-row items-start justify-between gap-3 border-b border-[color:var(--orion-line-soft)] p-0"
          style={{ padding: "18px 22px" }}
        >
          <div className="flex flex-col gap-0.5">
            <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("form.title.new")}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
              {t("form.title.newSub")}
            </SheetDescription>
          </div>
        </SheetHeader>
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ padding: "18px 22px" }}
        >
          <CuttingForm formId={formId} onSubmit={handleSubmit} />
          {serverError ? (
            <p role="alert" className="mt-3 text-[12px] text-[color:var(--status-err)]">
              {serverError}
            </p>
          ) : null}
        </div>
        <SheetFooter
          className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-end"
          style={{ padding: "14px 22px" }}
        >
          <Button
            type="button"
            variant="ghost"
            className={CANCEL_BUTTON_CLASS}
            onClick={() => handleOpenChange(false)}
            disabled={create.isPending}
          >
            {t("form.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            className={PRIMARY_BUTTON_CLASS}
            style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
            disabled={create.isPending}
          >
            <Check size={13} strokeWidth={2.2} />
            {t("form.submitNew")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
