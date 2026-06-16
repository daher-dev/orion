"use client";

import { use } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Combine,
  Factory,
  Printer,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BatchStatusPill } from "@/components/batches/BatchStatusPill";
import { LoteEstampaGrid } from "@/components/batches/LoteEstampaGrid";
import {
  useAssembleBatch,
  useBatchDetail,
  useDeleteBatch,
  useShipBatch,
  useTransitionBatch,
} from "@/hooks/use-batches";
import { useOrders } from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import { printShippingLabels } from "@/lib/print-shipping-labels";
import type { BatchStatus } from "@/lib/schemas/batch";

const CARD =
  "rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-4 py-3";

/**
 * Allowed forward status transitions, mirroring the backend `_FORWARD` map
 * (services/batch.py). Lotes flow open → in_production → dispatched → done,
 * with cancel available from any non-terminal state. Note: the dedicated
 * Montar/Enviar buttons drive in_production/dispatched via the assemble/ship
 * endpoints (with their wiring); the raw status transitions stay available
 * for the remaining steps (e.g. mark done, cancel).
 */
const FORWARD: Record<BatchStatus, BatchStatus[]> = {
  open: ["in_production", "cancelled"],
  in_production: ["dispatched", "cancelled"],
  dispatched: ["done", "cancelled"],
  done: [],
  cancelled: [],
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

  const { data: batch, isPending, isError } = useBatchDetail(id);
  const { data: ordersPage } = useOrders({ batch_id: id, page_size: 100 });
  const assemble = useAssembleBatch();
  const ship = useShipBatch();
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

  const onAssemble = async () => {
    try {
      const res = await assemble.mutateAsync({ id });
      if (res.assembled.length === 0 && res.skipped.length === 0) {
        toast.message(t("toast.assembleNothing"));
      } else if (res.skipped.length > 0) {
        toast.warning(
          t("toast.assembledSome", {
            assembled: res.assembled.length,
            skipped: res.skipped.length,
          }),
        );
      } else {
        toast.success(t("toast.assembled", { count: res.assembled.length }));
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.detail ? err.detail : t("toast.assembleError"),
      );
    }
  };

  const onShip = async () => {
    try {
      const res = await ship.mutateAsync(id);
      toast.success(t("toast.shipped", { count: res.orders_total }));
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.detail ? err.detail : t("toast.shipError"),
      );
    }
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

  // The dedicated Montar/Enviar actions cover the in_production + dispatched
  // transitions; keep only the remaining raw status moves (e.g. done).
  const rawTargets = FORWARD[batch.status].filter(
    (target) => target !== "cancelled" && target !== "in_production" && target !== "dispatched",
  );

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
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label={t("summary.ready")}
          value={t("summary.readyOf", {
            ready: batch.orders_ready,
            total: batch.orders_total,
          })}
        />
        <SummaryCard label={t("summary.pieces")} value={batch.pieces_total} />
        <SummaryCard label={t("summary.needed")} value={batch.estampas.length} />
        <SummaryCard
          label={t("summary.toPrint")}
          value={batch.to_print_total}
          accent={batch.to_print_total > 0}
        />
      </div>

      {/* Action bar */}
      {canWrite ? (
        <TooltipProvider>
          <div className="mb-5 flex flex-wrap gap-2">
            {/* Montar */}
            <ActionWithTooltip
              disabled={!batch.needs_assembly || assemble.isPending}
              tooltip={!batch.needs_assembly ? t("detail.assembleDisabled") : undefined}
            >
              <Button
                type="button"
                onClick={onAssemble}
                disabled={!batch.needs_assembly || assemble.isPending}
                className="gap-1.5 bg-[color:var(--brand-prod)] text-[12.5px] text-white hover:brightness-95"
                data-testid="batch-assemble"
              >
                <Combine size={14} /> {t("actions.assemble")}
              </Button>
            </ActionWithTooltip>

            {/* Enviar */}
            <ActionWithTooltip
              disabled={!batch.can_ship || ship.isPending}
              tooltip={!batch.can_ship ? t("detail.shipDisabled") : undefined}
            >
              <Button
                type="button"
                onClick={onShip}
                disabled={!batch.can_ship || ship.isPending}
                className="gap-1.5 bg-[color:var(--status-ok)] text-[12.5px] text-white hover:brightness-95"
                data-testid="batch-ship"
              >
                <Truck size={14} /> {t("actions.ship")}
              </Button>
            </ActionWithTooltip>

            <Button
              type="button"
              variant="outline"
              onClick={onPrintShipping}
              className="gap-1.5 text-[12.5px]"
              data-testid="batch-print-shipping"
            >
              <Printer size={14} /> {t("detail.printShipping")}
            </Button>

            {rawTargets.map((target) => (
              <Button
                key={target}
                type="button"
                variant="outline"
                onClick={() => transition.mutate({ id, status: target })}
                disabled={transition.isPending}
                className="gap-1.5 text-[12.5px]"
                data-testid={`batch-transition-${target}`}
              >
                {target === "done" ? <CheckCircle2 size={14} /> : <Factory size={14} />}
                {transitionLabel(target)}
              </Button>
            ))}

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
        </TooltipProvider>
      ) : null}

      {/* Estampa grid */}
      <div className="mb-2.5 text-[12.5px] text-[color:var(--orion-ink-3)]">
        {t("estampas.subtitle", {
          designs: batch.estampas.length,
          items: batch.pieces_total,
        })}
      </div>
      <LoteEstampaGrid rows={batch.estampas} />
    </div>
  );
}

function ActionWithTooltip({
  children,
  disabled,
  tooltip,
}: {
  children: React.ReactNode;
  disabled: boolean;
  tooltip?: string;
}) {
  if (!disabled || !tooltip) return <>{children}</>;
  return (
    <Tooltip>
      {/* span wrapper so the tooltip still fires over a disabled button */}
      <TooltipTrigger asChild>
        <span tabIndex={0}>{children}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
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

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className={CARD}>
      <span className="block text-[11px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <span
        className="text-[20px] font-medium"
        style={{
          fontVariantNumeric: "tabular-nums",
          color: accent ? "var(--brand-sales)" : "var(--orion-ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
