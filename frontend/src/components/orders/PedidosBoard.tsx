"use client";

import { useMemo, useState } from "react";
import {
  ChevronRight,
  Factory,
  GitMerge,
  Layers,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardColumn } from "./BoardColumn";
import { OrderCard } from "./OrderCard";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { EtiquetaModal } from "./separation/EtiquetaModal";
import { VincularSheet } from "@/components/mapping/VincularSheet";
import { BatchStatusPill } from "@/components/batches/BatchStatusPill";
import { useCreateBatch } from "@/hooks/use-batches";
import { useGenerateLabels } from "@/hooks/use-separation";
import { ApiError } from "@/lib/api-client";
import { orderStage, type Order } from "@/lib/schemas/order";
import type { BatchListItem } from "@/lib/schemas/batch";
import type { SeparationLabel } from "@/lib/schemas/separation";

/**
 * The Pedidos lifecycle board (port of `separacao.jsx` `PedidosBoard`).
 *
 * Four columns — Mapeamento / Produção / Separação / Envio — bucketed
 * client-side from the backend readiness flags (`orderStage`). The Envio
 * column lists the Lotes. Separação supports multi-select → "Criar Lote (N)"
 * and per-card "Imprimir etiquetas"; Mapeamento cards open the VincularSheet.
 */
type Props = {
  orders: Order[];
  batches: BatchListItem[];
  batchesLoading?: boolean;
  canWrite: boolean;
};

export function PedidosBoard({
  orders,
  batches,
  batchesLoading,
  canWrite,
}: Props) {
  const t = useTranslations("orders.board");
  const tb = useTranslations("batches");
  const router = useRouter();
  const createBatch = useCreateBatch();
  const generate = useGenerateLabels();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [vincOrder, setVincOrder] = useState<Order | null>(null);
  const [modalLabels, setModalLabels] = useState<SeparationLabel[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const byStage = useMemo(() => {
    const buckets: Record<
      "mapeamento" | "producao" | "separacao",
      Order[]
    > = { mapeamento: [], producao: [], separacao: [] };
    for (const o of orders) {
      const stage = orderStage(o);
      if (stage !== "envio") buckets[stage].push(o);
    }
    return buckets;
  }, [orders]);

  const sortedBatches = useMemo(
    () =>
      batches
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [batches],
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Selection only ever counts orders still visible in the Separação column.
  const separacaoIds = useMemo(
    () => new Set(byStage.separacao.map((o) => o.id)),
    [byStage.separacao],
  );
  const selCount = [...selected].filter((id) => separacaoIds.has(id)).length;

  const onCreateLote = async () => {
    const orderIds = [...selected].filter((id) => separacaoIds.has(id));
    if (orderIds.length === 0 || createBatch.isPending) return;
    try {
      const batch = await createBatch.mutateAsync({ order_ids: orderIds });
      toast.success(tb("toast.created"));
      setSelected(new Set());
      router.push(`/orders/batches/${batch.id}`);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(detail || t("createError"));
    }
  };

  /** Generate (print) labels for an order, then open the etiqueta modal. */
  const openEtiquetas = async (order: Order) => {
    if (generate.isPending) return;
    try {
      const res = await generate.mutateAsync(order.id);
      if (res.labels.length === 0) return;
      setModalLabels(res.labels);
      setModalOpen(true);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(detail || t("labelError"));
    }
  };

  return (
    <div className="-mx-0.5 overflow-x-auto pb-1.5">
      <div
        className="grid items-start gap-3"
        style={{ gridTemplateColumns: "repeat(4, minmax(228px, 1fr))" }}
      >
        <BoardColumn
          testId="board-column-mapeamento"
          label={t("columns.mapeamento")}
          icon={GitMerge}
          color="var(--brand-sales)"
          count={byStage.mapeamento.length}
          emptyText={t("empty.mapeamento")}
          isEmpty={byStage.mapeamento.length === 0}
        >
          {byStage.mapeamento.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              stage="mapeamento"
              onOpen={setOpenOrder}
              onVincular={canWrite ? setVincOrder : undefined}
            />
          ))}
        </BoardColumn>

        <BoardColumn
          testId="board-column-producao"
          label={t("columns.producao")}
          icon={Factory}
          color="var(--brand-prod)"
          count={byStage.producao.length}
          emptyText={t("empty.producao")}
          isEmpty={byStage.producao.length === 0}
        >
          {byStage.producao.map((o) => (
            <OrderCard key={o.id} order={o} stage="producao" onOpen={setOpenOrder} />
          ))}
        </BoardColumn>

        <BoardColumn
          testId="board-column-separacao"
          label={t("columns.separacao")}
          icon={PackageCheck}
          color="var(--status-ok)"
          count={byStage.separacao.length}
          emptyText={t("empty.separacao")}
          isEmpty={byStage.separacao.length === 0}
          headerExtra={
            canWrite && selCount > 0 ? (
              <Button
                type="button"
                size="sm"
                data-testid="board-create-batch"
                disabled={createBatch.isPending}
                onClick={onCreateLote}
                className="h-auto gap-1 rounded-[6px] bg-[color:var(--brand-sales)] px-2 py-1 text-[12px] font-medium text-white hover:brightness-95"
              >
                <Layers size={12} /> {t("createBatch", { count: selCount })}
              </Button>
            ) : null
          }
        >
          {byStage.separacao.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              stage="separacao"
              selected={selected.has(o.id)}
              onToggleSelect={canWrite ? toggleSelect : undefined}
              onOpen={setOpenOrder}
              onEtiquetas={canWrite ? openEtiquetas : undefined}
            />
          ))}
        </BoardColumn>

        <BoardColumn
          testId="board-column-envio"
          label={t("columns.envio")}
          icon={Truck}
          color="var(--brand-inv)"
          count={sortedBatches.length}
          emptyText={t("empty.envio")}
          isEmpty={!batchesLoading && sortedBatches.length === 0}
        >
          {batchesLoading ? (
            <>
              <Skeleton className="h-[78px] rounded-[8px]" />
              <Skeleton className="h-[78px] rounded-[8px]" />
            </>
          ) : (
            sortedBatches.map((b) => (
              <LoteCard
                key={b.id}
                batch={b}
                onOpen={() => router.push(`/orders/batches/${b.id}`)}
              />
            ))
          )}
        </BoardColumn>
      </div>

      <OrderDetailSheet
        order={openOrder}
        open={openOrder !== null}
        onOpenChange={(open) => {
          if (!open) setOpenOrder(null);
        }}
      />

      <VincularSheet
        order={vincOrder}
        open={vincOrder !== null}
        onOpenChange={(open) => {
          if (!open) setVincOrder(null);
        }}
      />

      <EtiquetaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        labels={modalLabels}
      />
    </div>
  );
}

function LoteCard({
  batch,
  onOpen,
}: {
  batch: BatchListItem;
  onOpen: () => void;
}) {
  const t = useTranslations("batches");
  return (
    <div
      data-testid={`board-lote-${batch.id}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="cursor-pointer rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-3"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[9px] border"
          style={{
            background: "var(--orion-surface-2)",
            borderColor: "var(--orion-line)",
            color: "var(--orion-ink-2)",
          }}
        >
          <Layers size={15} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12.5px] font-semibold text-[color:var(--orion-ink)]">
              {batch.code}
            </span>
            <BatchStatusPill status={batch.status} />
          </div>
          {batch.name ? (
            <div className="mt-0.5 truncate text-[11px] text-[color:var(--orion-ink-3)]">
              {batch.name}
            </div>
          ) : null}
        </div>
        <ChevronRight
          size={15}
          className="flex-shrink-0 text-[color:var(--orion-ink-3)]"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-[color:var(--orion-line-soft)] pt-2">
        <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">
          <b className="font-serif text-[14px] text-[color:var(--orion-ink-2)]">
            {batch.total_orders}
          </b>{" "}
          {t("columns.orders").toLowerCase()}
        </span>
        <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">
          <b className="font-serif text-[14px] text-[color:var(--orion-ink-2)]">
            {batch.total_pieces}
          </b>{" "}
          {t("columns.pieces").toLowerCase()}
        </span>
      </div>
    </div>
  );
}
