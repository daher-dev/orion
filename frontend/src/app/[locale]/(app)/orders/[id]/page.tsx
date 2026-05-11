"use client";

import { use, useState } from "react";
import { CircleDollarSign, ExternalLink, PackageCheck, Truck, Undo2, XCircle } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
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
import { OrderChannelChip } from "@/components/orders/OrderChannelChip";
import { OrderDetailHeader } from "@/components/orders/OrderDetailHeader";
import { OrderFormSheet } from "@/components/orders/OrderFormSheet";
import { OrderLineItem } from "@/components/orders/OrderLineItem";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { shortOrderCode } from "@/components/orders/OrdersTable";
import {
  useDeleteOrder,
  useOrder,
  useTransitionOrderStatus,
} from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import {
  canTransition,
  type Order,
  type OrderStatus,
} from "@/lib/schemas/order";

type RouteParams = { id: string; locale: string };

export default function OrderDetailPage({ params }: { params: Promise<RouteParams> }) {
  const { id } = use(params);
  const t = useTranslations("orders");
  const router = useRouter();
  const canRead = useCanAccess("orders.read");
  const canWrite = useCanAccess("orders.write");
  const { data: order, isPending, isError } = useOrder(id);
  const transition = useTransitionOrderStatus();
  const deleteOrder = useDeleteOrder();

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!canRead) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[120px] rounded-[14px]" />
        <Skeleton className="h-[180px] rounded-[14px]" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-[color:var(--status-err)]">
          {t("fallback.notFound")}
        </p>
        <Link
          href="/orders"
          className="text-[12px] text-[color:var(--brand-sales)] underline"
        >
          {t("actions.back")}
        </Link>
      </div>
    );
  }

  async function handleTransition(next: OrderStatus) {
    try {
      await transition.mutateAsync({ id: order!.id, status: next });
      toast.success(t("form.toasts.transitioned"));
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  async function handleDelete() {
    try {
      await deleteOrder.mutateAsync(order!.id);
      toast.success(t("form.toasts.deleted"));
      router.push("/orders");
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

  return (
    <div>
      <OrderDetailHeader
        order={order}
        canWrite={canWrite}
        onEdit={() => setEditing(true)}
        onDelete={() => setConfirmingDelete(true)}
      />

      {/* Customer + Ad block (mirrors design's two-column metadata grid) */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CustomerBlock order={order} />
        <AdBlock order={order} />
      </div>

      {/* Line item card */}
      <Card title={t("detail.lineItem")} testid="order-detail-line-items">
        <OrderLineItem order={order} />
        <OrderTotalRow order={order} />
      </Card>

      {/* Status timeline */}
      <Card title={t("detail.statusTimeline")} testid="order-detail-timeline">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11.5px] text-[color:var(--orion-ink-3)]">
            {canWrite ? t("detail.lineItemHint") : null}
          </p>
        </div>
        <OrderStatusTimeline
          status={order.status}
          onSelect={canWrite ? handleTransition : undefined}
          disabled={!canWrite}
        />
        {/* Side actions (cancel + return) — only visible when valid. */}
        {canWrite ? <TransitionRail order={order} onSelect={handleTransition} /> : null}
      </Card>

      <OrderFormSheet
        open={editing}
        initial={order}
        navigateOnCreate={false}
        onOpenChange={setEditing}
      />

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
    </div>
  );
}

function Card({
  title,
  children,
  testid,
}: {
  title: string;
  children: React.ReactNode;
  testid?: string;
}) {
  return (
    <section
      data-testid={testid}
      className="mb-4 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5"
    >
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CustomerBlock({ order }: { order: Order }) {
  const t = useTranslations("orders.detail");
  return (
    <Card title={t("customerBlock")}>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[color:var(--orion-ink)] hover:underline"
      >
        {order.client.name}
        <ExternalLink size={11} strokeWidth={1.8} className="text-[color:var(--orion-ink-3)]" />
      </Link>
      {order.client.email ? (
        <p className="mt-1 text-[12px] text-[color:var(--orion-ink-3)]">
          {order.client.email}
        </p>
      ) : null}
    </Card>
  );
}

function AdBlock({ order }: { order: Order }) {
  const t = useTranslations("orders.detail");
  return (
    <Card title={t("adBlock")}>
      <Link
        href={`/ads`}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[color:var(--orion-ink)] hover:underline"
      >
        {order.ad.title}
        <ExternalLink size={11} strokeWidth={1.8} className="text-[color:var(--orion-ink-3)]" />
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <OrderChannelChip channel={order.ad.ecommerce} />
        {order.external_order_id ? (
          <span className="rounded-[4px] border border-[color:var(--orion-line-soft)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--orion-ink-2)]">
            {order.external_order_id}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function OrderTotalRow({ order }: { order: Order }) {
  const t = useTranslations("orders.detail");
  const locale = useLocale();
  const format = useFormatter();
  void format;

  const currency = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: locale === "pt-BR" ? "BRL" : "USD",
  });
  const total = Number(order.sale_price) * order.quantity;
  return (
    <div
      className="mt-2 flex items-baseline justify-end gap-3 border-t border-[color:var(--orion-line-soft)] pt-3"
      data-testid="order-total"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {t("total")}
      </span>
      <span
        className="font-serif text-[22px] text-[color:var(--orion-ink)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {currency.format(total)}
      </span>
    </div>
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

  // Surface the timeline-side actions that aren't a "forward" step:
  // cancel + return are reachable from many states but never via the
  // linear rail.
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
    <div
      data-testid="order-transition-rail"
      className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--orion-line-soft)] pt-4"
    >
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
          {a.label} <span className="sr-only">{shortOrderCode(order.id)}</span>
        </Button>
      ))}
    </div>
  );
}
