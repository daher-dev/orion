"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
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
import { useCreateOrder, useUpdateOrder } from "@/hooks/use-orders";
import { ApiError } from "@/lib/api-client";
import {
  buildOrderCreatePayload,
  type Order,
  type OrderFormPayload,
} from "@/lib/schemas/order";
import { OrderForm } from "./OrderForm";

type Props = {
  open: boolean;
  initial?: Order | null;
  /** If true, navigate to the new order's detail page after create. */
  navigateOnCreate?: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const CANCEL_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

export function OrderFormSheet({
  open,
  initial,
  navigateOnCreate = true,
  onOpenChange,
}: Props) {
  const t = useTranslations("orders");
  const router = useRouter();
  const formId = useId();
  const isEdit = !!initial;
  const create = useCreateOrder();
  const update = useUpdateOrder();
  const [serverError, setServerError] = useState<string | null>(null);

  const isSubmitting = create.isPending || update.isPending;

  async function handleSubmit(values: OrderFormPayload) {
    setServerError(null);
    try {
      if (isEdit && initial) {
        await update.mutateAsync({
          id: initial.id,
          payload: {
            sale_price: values.sale_price.toFixed(2),
            ordered_at: new Date(values.ordered_at).toISOString(),
            external_order_id: values.external_order_id,
            quantity: values.quantity,
          },
        });
        toast.success(t("form.toasts.updated"));
        onOpenChange(false);
      } else {
        const result = await create.mutateAsync(buildOrderCreatePayload(values));
        toast.success(t("form.toasts.created"));
        onOpenChange(false);
        if (navigateOnCreate) {
          router.push(`/orders/${result.id}`);
        }
      }
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
              {isEdit ? t("form.title.edit") : t("form.title.new")}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
              {isEdit ? t("form.title.editSub") : t("form.title.newSub")}
            </SheetDescription>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: "18px 22px" }}>
          <OrderForm formId={formId} initial={initial ?? undefined} onSubmit={handleSubmit} />
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
            disabled={isSubmitting}
          >
            {t("form.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            className={PRIMARY_BUTTON_CLASS}
            style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
            disabled={isSubmitting}
          >
            <Check size={13} strokeWidth={2.2} />
            {isEdit ? t("form.save") : t("form.submitNew")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
