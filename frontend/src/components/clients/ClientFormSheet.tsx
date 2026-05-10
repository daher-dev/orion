"use client";

import { useId } from "react";
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
import { ClientForm } from "@/components/clients/ClientForm";
import {
  useCreateClient,
  useUpdateClient,
} from "@/hooks/use-clients";
import type { ClientCreate, ClientRead } from "@/lib/schemas/client";

/**
 * Side sheet wrapping the client form — direct port of design's `Sheet`:
 *   width 480px max, slides from right, head + body + foot rhythm.
 *   foot uses --orion-bg with right-aligned buttons (cancel + primary).
 */
export type ClientFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ClientRead;
};

export function ClientFormSheet({ open, onOpenChange, initial }: ClientFormSheetProps) {
  const t = useTranslations("clients.form");
  const formId = useId();
  const isEdit = !!initial;
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const isPending = createClient.isPending || updateClient.isPending;

  const handleSubmit = async (values: ClientCreate) => {
    try {
      if (isEdit && initial) {
        await updateClient.mutateAsync({ id: initial.id, payload: values });
        toast.success(t("toasts.updated"));
      } else {
        await createClient.mutateAsync(values);
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
        // Design source: width min(480px, 100vw), surface bg, line-l 1px,
        // shadow -8px 0 32px -8px rgba(31,27,21,.18). Override shadcn defaults.
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[480px]"
      >
        {/* .sheet-head — 18 22 padding, line-soft border-b. */}
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {isEdit ? t("title.edit") : t("title.new")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEdit ? t("title.edit") : t("title.new")}
          </SheetDescription>
        </SheetHeader>

        {/* .sheet-body — flex 1, overflow-y, padding 18 22. */}
        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          <ClientForm formId={formId} initial={initial} onSubmit={handleSubmit} />
        </div>

        {/* .sheet-foot — bg=bg, line-soft border-t, padding 14 22, gap 8 right. */}
        <SheetFooter className="flex-row justify-end gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-[22px] py-[14px]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            // .btn — 7px 13px padding, 13px text, weight 500, radius 6px,
            // border line, bg surface
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isPending}
            // .btn-primary — accent bg, white ink, accent-edge border, inset+outer shadow
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)",
            }}
          >
            {t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
