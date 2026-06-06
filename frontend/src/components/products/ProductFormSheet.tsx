"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { useCreateProduct, useDeleteProduct, useUpdateProduct } from "@/hooks/use-products";
import type { Product, ProductCreate } from "@/lib/schemas/product";
import { ProductForm } from "@/components/products/ProductForm";

export type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Product | null;
};

// Footer delete affordance — same .btn footprint as Cancel, coloured
// with --status-err so it reads as destructive. Anchors the left of the
// footer so save/cancel stay on the right.
const DELETE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

export function ProductFormSheet({ open, onOpenChange, initial }: ProductFormSheetProps) {
  const t = useTranslations("products");
  const tForm = useTranslations("products.form");
  const formId = useId();
  const isEdit = !!initial;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPending =
    createProduct.isPending || updateProduct.isPending || deleteProduct.isPending;

  const handleSubmit = async (payload: ProductCreate) => {
    if (isEdit && initial) {
      await updateProduct.mutateAsync({ id: initial.id, payload });
      toast.success(tForm("toasts.updated"));
    } else {
      await createProduct.mutateAsync(payload);
      toast.success(tForm("toasts.created"));
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!isEdit || !initial) return;
    try {
      await deleteProduct.mutateAsync(initial.id);
      toast.success(tForm("toasts.deleted"));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(tForm("toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-[560px]"
        data-testid="product-form-sheet"
      >
        <SheetHeader className="gap-1 border-b border-[color:var(--orion-line-soft)] px-[22px] py-[18px]">
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {isEdit ? tForm("title.edit") : tForm("title.new")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEdit ? tForm("title.edit") : tForm("title.new")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          <ProductForm formId={formId} initial={initial} onSubmit={handleSubmit} />
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
              {t("actions.delete")}
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
              {tForm("cancel")}
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={isPending}
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
              }}
              data-testid="product-form-submit"
            >
              {tForm("save")}
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
            <AlertDialogCancel disabled={deleteProduct.isPending}>
              {tForm("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteProduct.isPending}
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
