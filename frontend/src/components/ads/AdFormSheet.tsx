"use client";

import { useId, useState } from "react";
import { Check, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useCreateAd, useDeleteAd, useUpdateAd } from "@/hooks/use-ads";
import { ApiError } from "@/lib/api-client";
import type { Ad, AdFormPayload } from "@/lib/schemas/ad";
import { AdForm } from "./AdForm";

type Props = {
  open: boolean;
  initial?: Ad | null;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const CANCEL_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

// Delete button — same .btn footprint as Cancel, but coloured by --status-err
// to read as destructive. Sits on the left of the footer so save/cancel stay
// on the right, matching the standard "danger anchor / primary lead" sheet
// pattern from the design source.
const DELETE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

export function AdFormSheet({ open, initial, onOpenChange }: Props) {
  const t = useTranslations("ads");
  const formId = useId();
  const isEdit = !!initial;
  const create = useCreateAd();
  const update = useUpdateAd();
  const remove = useDeleteAd();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isSubmitting = create.isPending || update.isPending || remove.isPending;

  async function handleSubmit(payload: AdFormPayload) {
    setServerError(null);
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, payload });
        toast.success(t("form.toasts.updated"));
      } else {
        await create.mutateAsync(payload);
        toast.success(t("form.toasts.created"));
      }
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

  async function handleDelete() {
    if (!isEdit || !initial) return;
    try {
      await remove.mutateAsync(initial.id);
      toast.success(t("toasts.deleted"));
      setConfirmDelete(false);
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
    if (!next) {
      setServerError(null);
      setConfirmDelete(false);
    }
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
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ padding: "18px 22px" }}
        >
          <AdForm formId={formId} initial={initial ?? undefined} onSubmit={handleSubmit} />
          {serverError ? (
            <p role="alert" className="mt-3 text-[12px] text-[color:var(--status-err)]">
              {serverError}
            </p>
          ) : null}
        </div>
        <SheetFooter
          className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-between"
          style={{ padding: "14px 22px" }}
        >
          {/* Edit mode anchors the destructive action on the left so it's
              spatially separated from the primary save/cancel pair on the
              right. New-record mode hides the slot entirely. */}
          {isEdit ? (
            <Button
              type="button"
              variant="ghost"
              className={DELETE_BUTTON_CLASS}
              onClick={() => setConfirmDelete(true)}
              disabled={isSubmitting}
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {t("actions.delete")}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex items-center gap-2">
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
          </div>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
