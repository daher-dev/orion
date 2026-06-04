"use client";

import { useState } from "react";
import {
  CircleDollarSign,
  ExternalLink,
  PackageCheck,
  Pencil,
  Trash2,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrderChannelChip } from "./OrderChannelChip";
import { OrderFormSheet } from "./OrderFormSheet";
import { OrderLineItem } from "./OrderLineItem";
import { OrderStatusPill } from "./OrderStatusPill";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { shortOrderCode } from "./OrdersTable";
import {
  useDeleteOrder,
  useOrder,
  useTransitionOrderStatus,
} from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import { canTransition, type Order, type OrderStatus } from "@/lib/schemas/order";

type Props = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[560px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

export function OrderDetailSheet({ order, open, onOpenChange }: Props) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const locale = useLocale();
  const canWrite = useCanAccess("orders.write");
  const { data: fresh, isPending, isError } = useOrder(order?.id ?? null);
  const transition = useTransitionOrderStatus();
  const deleteOrder = useDeleteOrder();

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const displayed = fresh ?? order;

  const currency = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: locale === "pt-BR" ? "BRL" : "USD",
  });

  async function handleTransition(next: OrderStatus) {
    if (!displayed) return;
    try {
      await transition.mutateAsync({ id: displayed.id, status: next });
      toast.success(t("form.toasts.transitioned"));
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  async function handleDelete() {
    if (!displayed) return;
    try {
      await deleteOrder.mutateAsync(displayed.id);
      toast.success(t("form.toasts.deleted"));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t("form.toasts.deleteBlocked"));
      } else {
        const detail = err instanceof Error ? err.message : "";
        toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
      }
      setConfirmingDelete(false);
    }
  }

  const placedOn = displayed ? new Date(displayed.ordered_at) : null;
  const placedDate =
    placedOn && !Number.isNaN(placedOn.getTime())
      ? format.dateTime(placedOn, { day: "2-digit", month: "2-digit", year: "numeric" })
      : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={SHEET_CLASS} side="right">
          <SheetHeader
            className="border-b border-[color:var(--orion-line-soft)]"
            style={{ padding: "18px 22px" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <SheetTitle className="flex items-center gap-2 font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
                  {displayed ? shortOrderCode(displayed.id) : t("actions.view")}
                  {displayed ? <OrderStatusPill status={displayed.status} /> : null}
                </SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
                  {displayed ? <OrderChannelChip channel={displayed.ad.ecommerce} /> : null}
                  {placedDate ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{t("detail.placedOn", { date: placedDate })}</span>
                    </>
                  ) : null}
                </SheetDescription>
              </div>
              {canWrite && displayed ? (
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("actions.edit")}
                    onClick={() => setEditing(true)}
                    className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
                  >
                    <Pencil size={13} strokeWidth={1.8} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("actions.delete")}
                    onClick={() => setConfirmingDelete(true)}
                    className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--status-err)]"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </Button>
                </div>
              ) : null}
            </div>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ padding: "18px 22px" }}
          >
            {isPending && !displayed ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-[100px] rounded-[12px]" />
                <Skeleton className="h-[120px] rounded-[12px]" />
                <Skeleton className="h-[160px] rounded-[12px]" />
              </div>
            ) : isError || !displayed ? (
              <p className="text-center text-[13px] text-[color:var(--status-err)]">
                {t("fallback.notFound")}
              </p>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <section className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                    <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                      {t("detail.customerBlock")}
                    </h3>
                    {displayed.client ? (
                      <>
                        <Link
                          href="/clients"
                          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--orion-ink)] hover:underline"
                        >
                          {displayed.client.name}
                          <ExternalLink
                            size={10}
                            strokeWidth={1.8}
                            className="text-[color:var(--orion-ink-3)]"
                          />
                        </Link>
                        {displayed.client.email ? (
                          <p className="mt-0.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
                            {displayed.client.email}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[13px] text-[color:var(--orion-ink-3)]">—</span>
                    )}
                  </section>
                  <section className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                    <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                      {t("detail.adBlock")}
                    </h3>
                    <Link
                      href="/ads"
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--orion-ink)] hover:underline"
                    >
                      {displayed.ad.title}
                      <ExternalLink
                        size={10}
                        strokeWidth={1.8}
                        className="text-[color:var(--orion-ink-3)]"
                      />
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <OrderChannelChip channel={displayed.ad.ecommerce} />
                      {displayed.external_order_id ? (
                        <span className="rounded-[4px] border border-[color:var(--orion-line-soft)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--orion-ink-2)]">
                          {displayed.external_order_id}
                        </span>
                      ) : null}
                    </div>
                  </section>
                </div>

                <section className="mb-4 rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                  <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("detail.lineItem")}
                  </h3>
                  <OrderLineItem order={displayed} />
                  <div className="mt-2 flex items-baseline justify-end gap-3 border-t border-[color:var(--orion-line-soft)] pt-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                      {t("detail.total")}
                    </span>
                    <span
                      className="font-serif text-[20px] text-[color:var(--orion-ink)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {displayed.sale_price != null ? currency.format(Number(displayed.sale_price) * displayed.quantity) : "—"}
                    </span>
                  </div>
                </section>

                <section className="mb-4 rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                  <h3 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("detail.statusTimeline")}
                  </h3>
                  {canWrite ? (
                    <p className="mb-3 text-[11.5px] text-[color:var(--orion-ink-3)]">
                      {t("detail.lineItemHint")}
                    </p>
                  ) : null}
                  <OrderStatusTimeline
                    status={displayed.status}
                    onSelect={canWrite ? handleTransition : undefined}
                    disabled={!canWrite}
                  />
                  {canWrite ? (
                    <TransitionRail order={displayed} onSelect={handleTransition} />
                  ) : null}
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {displayed && editing ? (
        <OrderFormSheet
          open={editing}
          initial={displayed}
          navigateOnCreate={false}
          onOpenChange={setEditing}
        />
      ) : null}

      <AlertDialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmingDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteOrder.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteOrder.isPending}
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
    </>
  );
}

function TransitionRail({
  order,
  onSelect,
}: {
  order: Order;
  onSelect: (status: OrderStatus) => void | Promise<void>;
}) {
  const t = useTranslations("orders.actions");

  const actions: Array<{
    target: OrderStatus;
    label: string;
    icon: React.ReactNode;
    tone: "destructive" | "default";
  }> = [
    {
      target: "paid",
      label: t("markPaid"),
      icon: <CircleDollarSign size={13} strokeWidth={1.8} />,
      tone: "default",
    },
    {
      target: "shipped",
      label: t("markShipped"),
      icon: <Truck size={13} strokeWidth={1.8} />,
      tone: "default",
    },
    {
      target: "delivered",
      label: t("markDelivered"),
      icon: <PackageCheck size={13} strokeWidth={1.8} />,
      tone: "default",
    },
    {
      target: "cancelled",
      label: t("cancel"),
      icon: <XCircle size={13} strokeWidth={1.8} />,
      tone: "destructive",
    },
    {
      target: "returned",
      label: t("returnOrder"),
      icon: <Undo2 size={13} strokeWidth={1.8} />,
      tone: "destructive",
    },
  ];

  const visible = actions.filter(
    (a) => canTransition(order.status, a.target) && a.target !== order.status,
  );
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--orion-line-soft)] pt-4">
      {visible.map((a) => (
        <Button
          key={a.target}
          type="button"
          data-testid={`transition-${a.target}`}
          variant="ghost"
          onClick={() => void onSelect(a.target)}
          className={
            a.tone === "destructive"
              ? "h-auto gap-[6px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[12px] py-[7px] text-[13px] text-[color:var(--status-err)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
              : "h-auto gap-[6px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[12px] py-[7px] text-[13px] text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          }
        >
          {a.icon}
          {a.label}
        </Button>
      ))}
    </div>
  );
}
