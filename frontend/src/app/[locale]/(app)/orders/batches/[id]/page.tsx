"use client";

import { use } from "react";
import { ArrowLeft, CheckCircle2, Factory, Printer, Trash2, Truck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchStatusPill } from "@/components/batches/BatchStatusPill";
import { useBatch, useTransitionBatch, useDeleteBatch } from "@/hooks/use-batches";
import { useOrders } from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { printShippingLabels } from "@/lib/print-shipping-labels";
import type { BatchStatus } from "@/lib/schemas/batch";

const CARD =
  "rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-4 py-3";

/**
 * Allowed forward status transitions, mirroring the backend `_FORWARD` map
 * (services/batch.py). Lotes flow open → in_production → dispatched → done,
 * with cancel available from any non-terminal state.
 */
const FORWARD: Record<BatchStatus, BatchStatus[]> = {
  open: ["in_production", "cancelled"],
  in_production: ["dispatched", "cancelled"],
  dispatched: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

const TRANSITION_ICON: Record<BatchStatus, typeof Factory> = {
  open: Factory,
  in_production: Factory,
  dispatched: Truck,
  done: CheckCircle2,
  cancelled: XCircle,
};

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("batches");
  const router = useRouter();
  const canWrite = useCanAccess("orders.write");

  const { data: batch, isPending, isError } = useBatch(id);
  const { data: ordersPage } = useOrders({ batch_id: id, page_size: 100 });
  const transition = useTransitionBatch();
  const remove = useDeleteBatch();

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (isError || !batch) {
    return (
      <div>
        <BackLink label={t("actions.back")} />
        <p className="mt-6 text-[13px] text-[color:var(--status-err)]">
          {t("detail.notFound")}
        </p>
      </div>
    );
  }

  const onPrintShipping = async () => {
    const urls = (ordersPage?.items ?? []).map((o) => o.shipping_label_url);
    const count = await printShippingLabels(urls);
    if (count === 0) toast.message(t("toast.noShippingLabels"));
  };

  const onDelete = () => {
    if (!window.confirm(t("detail.deleteConfirm"))) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(t("toast.deleted"));
        router.push("/orders/batches");
      },
    });
  };

  const transitionLabel = (target: BatchStatus): string => {
    if (target === "done") return t("detail.markDone");
    if (target === "cancelled") return t("detail.cancel");
    return t(`statuses.${target}`);
  };

  return (
    <div>
      <BackLink label={t("actions.back")} />

      {/* Header */}
      <div className="mb-4 mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-[26px] font-normal leading-tight tracking-[-0.02em] text-[color:var(--orion-ink)]">
          {batch.code}
        </h1>
        {batch.name ? (
          <span className="text-[14px] text-[color:var(--orion-ink-3)]">{batch.name}</span>
        ) : null}
        <BatchStatusPill status={batch.status} />
      </div>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <SummaryCard label={t("summary.orders")} value={batch.total_orders} />
        <SummaryCard label={t("summary.pieces")} value={batch.total_pieces} />
      </div>

      {/* Action bar */}
      {canWrite ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onPrintShipping}
            className="gap-1.5 text-[12.5px]"
            data-testid="batch-print-shipping"
          >
            <Printer size={14} /> {t("detail.printShipping")}
          </Button>
          {FORWARD[batch.status]
            .filter((target) => target !== "cancelled")
            .map((target) => {
              const Icon = TRANSITION_ICON[target];
              return (
                <Button
                  key={target}
                  type="button"
                  variant="outline"
                  onClick={() => transition.mutate({ id, status: target })}
                  disabled={transition.isPending}
                  className="gap-1.5 text-[12.5px]"
                  data-testid={`batch-transition-${target}`}
                >
                  <Icon size={14} /> {transitionLabel(target)}
                </Button>
              );
            })}
          {FORWARD[batch.status].includes("cancelled") ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => transition.mutate({ id, status: "cancelled" })}
              disabled={transition.isPending}
              className="gap-1.5 text-[12.5px] text-[color:var(--orion-ink-2)]"
              data-testid="batch-transition-cancelled"
            >
              <XCircle size={14} /> {t("detail.cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            className="ml-auto gap-1.5 text-[12.5px] text-[color:var(--status-err)]"
            data-testid="batch-delete"
          >
            <Trash2 size={14} /> {t("detail.delete")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/orders/batches"
      className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink)]"
    >
      <ArrowLeft size={14} /> {label}
    </Link>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={CARD}>
      <span className="block text-[11px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <span
        className="text-[20px] font-medium text-[color:var(--orion-ink)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}
