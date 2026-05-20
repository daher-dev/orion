"use client";

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ClientForm } from "@/components/clients/ClientForm";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import {
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from "@/hooks/use-clients";
import { useOrders } from "@/hooks/use-orders";
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

// Footer delete button — same .btn footprint as Cancel, --status-err text.
const DELETE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

export function ClientFormSheet({ open, onOpenChange, initial }: ClientFormSheetProps) {
  const t = useTranslations("clients.form");
  const tActions = useTranslations("clients.actions");
  const format = useFormatter();
  const formId = useId();
  const isEdit = !!initial;
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPending =
    createClient.isPending || updateClient.isPending || deleteClient.isPending;

  const ordersQuery = useOrders(
    isEdit && initial ? { client_id: initial.id, page_size: 10 } : undefined,
  );

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

  const handleDelete = async () => {
    if (!isEdit || !initial) return;
    try {
      await deleteClient.mutateAsync(initial.id);
      toast.success(t("toasts.deleted"));
      setConfirmDelete(false);
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

          {isEdit && (
            <section className="mt-6 border-t border-[color:var(--orion-line-soft)] pt-5">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("sections.orderHistory")}
              </h3>
              {ordersQuery.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 rounded-[8px]" />
                  <Skeleton className="h-9 rounded-[8px]" />
                  <Skeleton className="h-9 rounded-[8px]" />
                </div>
              ) : ordersQuery.isError ? (
                <p className="text-[12px] text-[color:var(--status-err)]">
                  {t("orderHistory.loadError")}
                </p>
              ) : !ordersQuery.data?.items.length ? (
                <p className="text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("orderHistory.empty")}
                </p>
              ) : (
                <ol className="space-y-1">
                  {ordersQuery.data.items.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-2 rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-[color:var(--orion-ink)]">
                          {order.variation.product.name}
                        </p>
                        <p className="text-[11px] text-[color:var(--orion-ink-3)]">
                          {format.dateTime(new Date(order.ordered_at), {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                          {" · "}
                          {format.number(Number(order.sale_price), {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                      <OrderStatusPill status={order.status} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>

        {/* .sheet-foot — bg=bg, line-soft border-t, padding 14 22, gap 8.
            Edit mode anchors the destructive action on the left, save/cancel
            on the right; new-record mode hides the left slot. */}
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
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)",
              }}
            >
              {t("save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tActions("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tActions("confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClient.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteClient.isPending}
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
