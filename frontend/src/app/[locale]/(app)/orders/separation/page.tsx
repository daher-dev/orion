"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Printer, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHead } from "@/components/page/PageHead";
import { SeparationRow } from "@/components/orders/separation/SeparationRow";
import { EtiquetaModal } from "@/components/orders/separation/EtiquetaModal";
import { ScanCheckBar } from "@/components/orders/separation/ScanCheckBar";
import { useOrders } from "@/hooks/use-orders";
import { useGenerateLabels } from "@/hooks/use-separation";
import { useCanAccess } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/schemas/order";
import { ECOMMERCE_CHANNELS, type Ecommerce } from "@/lib/schemas/ad";
import type { SeparationLabel } from "@/lib/schemas/separation";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

export default function SeparationPage() {
  const t = useTranslations("separation");
  const canRead = useCanAccess("orders.read");
  const canWrite = useCanAccess("orders.write");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [channel, setChannel] = useState<Ecommerce | "all">("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLabels, setModalLabels] = useState<SeparationLabel[]>([]);

  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useOrders({
    q: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    channel: channel === "all" ? undefined : channel,
    page_size: 50,
  });

  const generate = useGenerateLabels();

  const rows = useMemo(() => data?.items ?? [], [data]);
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );
  const totalPieces = useMemo(
    () =>
      rows
        .filter((o) => selected[o.id])
        .reduce((sum, o) => sum + o.quantity, 0),
    [rows, selected],
  );

  const allSelected = rows.length > 0 && rows.every((o) => selected[o.id]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected({});
    } else {
      setSelected(Object.fromEntries(rows.map((o) => [o.id, true])));
    }
  };

  const refreshRow = (orderId: string) => {
    qc.invalidateQueries({ queryKey: qk.orders.items(orderId) });
  };

  /** Generate (print) labels for the given order ids, then open the modal. */
  const openEtiquetas = async (orderIds: string[]) => {
    if (orderIds.length === 0 || generate.isPending) return;
    try {
      const results = await Promise.all(
        orderIds.map((id) => generate.mutateAsync(id)),
      );
      const labels = results.flatMap((r) => r.labels);
      if (labels.length === 0) {
        toast.error(t("toast.noPieces"));
        return;
      }
      setModalLabels(labels);
      setModalOpen(true);
    } catch {
      toast.error(t("toast.generateError"));
    }
  };

  if (!canRead) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  return (
    <div>
      <PageHead
        subColor="var(--brand-sales)"
        mark={<Package size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
      />

      {/* Check-out scan bar — bip each label's QR to confirm the piece. */}
      {canWrite ? (
        <div className="mb-4">
          <ScanCheckBar onChecked={refreshRow} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search size={13} className="text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>

          <Select
            value={status}
            onValueChange={(v) => setStatus(v as OrderStatus | "all")}
          >
            <SelectTrigger
              aria-label={t("filters.status")}
              className="h-auto min-w-[140px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]"
            >
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.statusAll")}</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`orderStatuses.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as Ecommerce | "all")}
          >
            <SelectTrigger
              aria-label={t("filters.channel")}
              className="h-auto min-w-[140px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]"
            >
              <SelectValue placeholder={t("filters.channel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.channelAll")}</SelectItem>
              {ECOMMERCE_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`channels.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection / bulk action bar */}
        {canWrite ? (
          <div
            className="flex flex-wrap items-center gap-3 border-b border-[color:var(--orion-line-soft)] px-4 py-2.5 transition-colors"
            style={{
              background: selectedIds.length
                ? "color-mix(in oklab, var(--brand-sales) 8%, var(--orion-surface))"
                : "var(--orion-surface)",
            }}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              disabled={rows.length === 0}
            >
              {allSelected ? t("bar.clear") : t("bar.selectAll")}
            </Button>
            <span className="text-[13px] tabular-nums text-[color:var(--orion-ink-3)]">
              {selectedIds.length > 0
                ? t("bar.selectedCount", {
                    orders: selectedIds.length,
                    pieces: totalPieces,
                  })
                : t("bar.totalCount", { orders: rows.length })}
            </span>
            <span className="ml-auto">
              <Button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                style={{
                  borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)",
                }}
                disabled={selectedIds.length === 0 || generate.isPending}
                onClick={() => openEtiquetas(selectedIds)}
              >
                {generate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer size={14} strokeWidth={1.8} />
                )}
                {t("bar.printLabels")}
              </Button>
            </span>
          </div>
        ) : null}

        {/* Rows */}
        {isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : isError ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">
            {t("list.loadError")}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("list.empty")}
          </p>
        ) : (
          rows.map((order) => (
            <SeparationRow
              key={order.id}
              order={order}
              selected={!!selected[order.id]}
              expanded={!!expanded[order.id]}
              onToggleSelect={() =>
                setSelected((s) => ({ ...s, [order.id]: !s[order.id] }))
              }
              onToggleExpand={() =>
                setExpanded((e) => ({ ...e, [order.id]: !e[order.id] }))
              }
              onEtiquetas={() => openEtiquetas([order.id])}
            />
          ))
        )}
      </div>

      <EtiquetaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        labels={modalLabels}
        onPrinted={() => toast.success(t("toast.printed", { count: modalLabels.length }))}
      />
    </div>
  );
}
