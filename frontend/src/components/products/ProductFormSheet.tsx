"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products";
import type { Product, ProductCreate } from "@/lib/schemas/product";
import { ProductForm } from "@/components/products/ProductForm";

export type ProductFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Product | null;
};

export function ProductFormSheet({ open, onOpenChange, initial }: ProductFormSheetProps) {
  const t = useTranslations("products.form");
  const formId = useId();
  const isEdit = !!initial;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isPending = createProduct.isPending || updateProduct.isPending;

  const handleSubmit = async (payload: ProductCreate) => {
    if (isEdit && initial) {
      await updateProduct.mutateAsync({ id: initial.id, payload });
      toast.success(t("toasts.updated"));
    } else {
      await createProduct.mutateAsync(payload);
      toast.success(t("toasts.created"));
    }
    onOpenChange(false);
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
            {isEdit ? t("title.edit") : t("title.new")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEdit ? t("title.edit") : t("title.new")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[22px] py-[18px]">
          <ProductForm formId={formId} initial={initial} onSubmit={handleSubmit} />
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
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
            style={{
              borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
            }}
            data-testid="product-form-submit"
          >
            {t("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
