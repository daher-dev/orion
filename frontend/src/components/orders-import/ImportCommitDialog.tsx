"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowCount: number;
  isPending?: boolean;
  onConfirm: () => void;
};

/**
 * Commit confirmation dialog. Asks the operator to confirm persisting
 * `rowCount` reviewed rows before firing POST /commit. Uses the Sales
 * terracotta as the primary action color.
 */
export function ImportCommitDialog({
  open,
  onOpenChange,
  rowCount,
  isPending = false,
  onConfirm,
}: Props) {
  const t = useTranslations("ordersImport.commit");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("body", { count: rowCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className="gap-2 bg-[color:var(--brand-sales)] text-white hover:brightness-95"
            style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
          >
            {isPending ? <Loader2 size={13} className="animate-spin" /> : null}
            {t("save")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
