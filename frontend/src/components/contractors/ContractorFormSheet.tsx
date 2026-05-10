"use client";

import { useId, useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import type { Contractor, ContractorFormPayload } from "@/lib/schemas/contractor";
import {
  useCreateContractor,
  useDeleteContractor,
  useUpdateContractor,
} from "@/hooks/use-contractors";
import { ContractorForm } from "./ContractorForm";

type Props = {
  open: boolean;
  contractor: Contractor | null;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const CANCEL_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]";

const DESTRUCTIVE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

export function ContractorFormSheet({ open, contractor, onOpenChange }: Props) {
  const t = useTranslations("contractors");
  const formId = useId();
  const isEdit = contractor !== null;
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const create = useCreateContractor();
  const update = useUpdateContractor();
  const remove = useDeleteContractor();

  const defaultValues = useMemo(
    () =>
      contractor
        ? {
            name: contractor.name,
            address: contractor.address ?? "",
            phone: contractor.phone ?? "",
          }
        : undefined,
    [contractor],
  );

  const isSubmitting = create.isPending || update.isPending;

  function handleApiError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        setServerError(t("form.validation.duplicateName"));
        return;
      }
    }
    toast.error(t("toast.error"));
  }

  async function handleSubmit(payload: ContractorFormPayload) {
    setServerError(null);
    try {
      if (isEdit && contractor) {
        await update.mutateAsync({ id: contractor.id, payload });
        toast.success(t("toast.updated"));
      } else {
        await create.mutateAsync(payload);
        toast.success(t("toast.created"));
      }
      onOpenChange(false);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleDelete() {
    if (!contractor) return;
    try {
      await remove.mutateAsync(contractor.id);
      toast.success(t("toast.deleted"));
      setConfirmingDelete(false);
      onOpenChange(false);
    } catch {
      toast.error(t("toast.error"));
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setServerError(null);
    }
    onOpenChange(next);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className={SHEET_CLASS} side="right">
          <SheetHeader
            className="flex-row items-start justify-between gap-3 border-b border-[color:var(--orion-line-soft)] p-0"
            style={{ padding: "18px 22px" }}
          >
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="font-serif text-[18px] font-medium text-[color:var(--orion-ink)]">
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
            <ContractorForm
              formId={formId}
              defaultValues={defaultValues}
              serverError={serverError}
              onSubmit={handleSubmit}
            />
          </div>
          <SheetFooter
            className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-end"
            style={{ padding: "14px 22px" }}
          >
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                className={`${DESTRUCTIVE_BUTTON_CLASS} mr-auto`}
                disabled={remove.isPending || isSubmitting}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 size={13} strokeWidth={1.8} />
                {t("actions.delete")}
              </Button>
            ) : null}
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
              style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
              disabled={isSubmitting}
            >
              <Check size={13} strokeWidth={2.2} />
              {isEdit ? t("form.save") : t("form.submitNew")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={remove.isPending}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
