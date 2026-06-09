"use client";

import { use, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Printer,
  Send,
  Tag,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchStatusPill } from "@/components/batches/BatchStatusPill";
import { useBatch, useSaveBatchAdjustments, useTransitionBatch, useSendBatchToMontador, useDeleteBatch } from "@/hooks/use-batches";
import { useOrders } from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { printShippingLabels } from "@/lib/print-shipping-labels";
import type { BatchAdjustment } from "@/lib/schemas/batch";

type DesignGroup = {
  designId: string;
  code: string | null;
  name: string | null;
  rows: BatchAdjustment[];
  needed: number;
  onHand: number;
  toPrint: number;
  sent: boolean;
};

function groupByDesign(adjustments: BatchAdjustment[]): DesignGroup[] {
  const map = new Map<string, DesignGroup>();
  for (const a of adjustments) {
    let g = map.get(a.print_design_id);
    if (!g) {
      g = {
        designId: a.print_design_id,
        code: a.print_design_code ?? null,
        name: a.print_design_name ?? null,
        rows: [],
        needed: 0,
        onHand: 0,
        toPrint: 0,
        sent: true,
      };
      map.set(a.print_design_id, g);
    }
    g.rows.push(a);
    g.needed += a.qty_needed;
    // qty_stock is the per-(design,colour) on-hand at recompute; sum across
    // colour rows for the design-level "em estoque" figure.
    g.onHand += a.qty_stock;
    g.toPrint += a.qty_to_print;
    g.sent = g.sent && a.prints_sent;
  }
  return [...map.values()].sort((a, b) => b.needed - a.needed);
}

const CARD =
  "rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-4 py-3";

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
  const saveAdj = useSaveBatchAdjustments();
  const transition = useTransitionBatch();
  const sendMontador = useSendBatchToMontador();
  const remove = useDeleteBatch();

  // Per-design "to print" overrides. The displayed value falls back to the
  // batch's saved quantity, so no effect is needed to seed from server data.
  const groups = useMemo(() => groupByDesign(batch?.adjustments ?? []), [batch]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const valueFor = (g: DesignGroup) => edits[g.designId] ?? g.toPrint;

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

  const totalNeeded = groups.reduce((s, g) => s + g.needed, 0);
  const totalToPrint = groups.reduce((s, g) => s + valueFor(g), 0);
  const editable = canWrite && (batch.status === "open" || batch.status === "adjusted");

  const onSave = () => {
    saveAdj.mutate(
      {
        id,
        payload: {
          adjustments: groups.map((g) => ({
            print_design_id: g.designId,
            qty_to_print: valueFor(g),
          })),
        },
      },
      {
        onSuccess: () => toast.success(t("toast.saved")),
        onError: () => toast.error(t("list.loadError")),
      },
    );
  };

  const onSendMontador = () => {
    sendMontador.mutate(id, {
      onSuccess: (res) =>
        toast.success(
          t("toast.montadorOk", { ok: res.succeeded, failed: res.failed }),
        ),
      onError: () => toast.error(t("toast.montadorErr")),
    });
  };

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
        <SummaryCard label={t("summary.orders")} value={batch.total_orders} />
        <SummaryCard label={t("summary.pieces")} value={batch.total_pieces} />
        <SummaryCard label={t("summary.needed")} value={totalNeeded} />
        <SummaryCard label={t("summary.toPrint")} value={totalToPrint} />
      </div>

      {/* Action bar */}
      {canWrite ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onPrintShipping}
            className="gap-1.5 text-[12.5px]"
          >
            <Printer size={14} /> {t("detail.printShipping")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSendMontador}
            disabled={sendMontador.isPending || groups.length === 0}
            className="gap-1.5 text-[12.5px]"
          >
            {sendMontador.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {t("detail.sendMontador")}
          </Button>
          {batch.status === "printed" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                transition.mutate({ id, status: "done" })
              }
              className="gap-1.5 text-[12.5px]"
            >
              <CheckCircle2 size={14} /> {t("detail.markDone")}
            </Button>
          ) : null}
          {batch.status === "adjusted" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => transition.mutate({ id, status: "printed" })}
              className="gap-1.5 text-[12.5px]"
            >
              <Tag size={14} /> {t("detail.printLabels")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            className="ml-auto gap-1.5 text-[12.5px] text-[color:var(--status-err)]"
          >
            <Trash2 size={14} /> {t("detail.delete")}
          </Button>
        </div>
      ) : null}

      {/* Adjustments */}
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex items-center justify-between border-b border-[color:var(--orion-line-soft)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-[color:var(--orion-ink)]">
            {t("adjustments.title")}
          </h2>
          {editable ? (
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={saveAdj.isPending}
              className="gap-1.5 text-[12px]"
            >
              {saveAdj.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : null}
              {t("adjustments.save")}
            </Button>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("adjustments.empty")}
          </p>
        ) : (
          <div className="divide-y divide-[color:var(--orion-line-soft)]">
            {groups.map((g) => (
              <div key={g.designId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
                      {g.name ?? g.code ?? g.designId.slice(0, 8)}
                    </span>
                    {g.sent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--status-ok)]">
                        <CheckCircle2 size={11} /> {t("adjustments.sent")}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">
                    {g.rows.map((r) => `${r.product_color} (${r.qty_needed})`).join(" · ")}
                  </span>
                </div>
                <div className="text-right text-[12px] text-[color:var(--orion-ink-3)]">
                  <span className="block">{t("adjustments.needed")}</span>
                  <span
                    className="text-[14px] font-medium text-[color:var(--orion-ink)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {g.needed}
                  </span>
                </div>
                <div className="text-right text-[12px] text-[color:var(--orion-ink-3)]">
                  <span className="block">{t("adjustments.onHand")}</span>
                  <span
                    className="text-[14px] font-medium text-[color:var(--orion-ink)]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {g.onHand}
                  </span>
                </div>
                <div className="w-[88px] text-right">
                  <span className="mb-0.5 block text-[12px] text-[color:var(--orion-ink-3)]">
                    {t("adjustments.toPrint")}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    disabled={!editable}
                    value={valueFor(g)}
                    onChange={(e) =>
                      setEdits((s) => ({
                        ...s,
                        [g.designId]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="h-8 text-right text-[13px]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
