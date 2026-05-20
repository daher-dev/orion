"use client";

import { useEffect, useState } from "react";
import { Search, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { ShipmentTable } from "@/components/sewing/ShipmentTable";
import { SewingEmptyState } from "@/components/sewing/SewingEmptyState";
import { ShipmentDetailSheet } from "@/components/sewing/ShipmentDetailSheet";
import { ShipmentFormSheet } from "@/components/sewing/ShipmentFormSheet";
import { useShipments } from "@/hooks/use-sewing";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Shipment, ShipmentStatus } from "@/lib/schemas/sewing";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]";

/** Status filter option — `all` is local-only, the others are wire values. */
type StatusFilter = "all" | ShipmentStatus;

/**
 * Inline segmented control matching the design's `.seg` (`/docs/design/source/styles.css`).
 * Used here for the "Todas / Enviadas / Recebidas / Parciais" filter row in
 * the design's `Sewing` panel.
 */
function StatusSeg({
  value,
  onChange,
  options,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  options: Array<{ value: StatusFilter; label: string }>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Status filter"
      className="inline-flex items-center gap-0.5 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] p-0.5"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            data-active={active || undefined}
            data-testid={`sewing-status-${o.value}`}
            className={
              "rounded-[6px] px-3 py-1.5 text-[12.5px] transition-colors " +
              (active
                ? "bg-[color:var(--orion-surface)] font-medium text-[color:var(--orion-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink-2)]")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SewingPage() {
  const t = useTranslations("sewing");
  const canRead = useCanAccess("sewing.read");
  const canWrite = useCanAccess("sewing.write");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Shipment | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useShipments({
    q: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    page_size: 100,
  });

  const rows = data?.items ?? [];
  const showEmpty =
    !isPending &&
    !isError &&
    rows.length === 0 &&
    !debouncedSearch &&
    status === "all";

  if (!canRead) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: t("filters.statusAll") },
    { value: "sent", label: t("status.sent") },
    { value: "received", label: t("status.received") },
    { value: "partial", label: t("status.partial") },
  ];

  return (
    <div>
      <PageHead
        subColor="var(--brand-prod)"
        mark={<Send size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              className={PRIMARY_BUTTON_CLASS}
              style={{
                borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)",
              }}
            >
              <Send size={14} strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        {/* Toolbar — search on the left, segmented status filter on the
            right. Direct port of the `TableToolbar` row in the design's
            `Sewing` panel. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search size={13} className="text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>
          <div className="ml-auto">
            <StatusSeg value={status} onChange={setStatus} options={statusOptions} />
          </div>
        </div>

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
        ) : showEmpty ? (
          <SewingEmptyState onCreate={() => setCreating(true)} />
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("list.noResults")}
          </p>
        ) : (
          <ShipmentTable rows={rows} onView={(s) => setViewing(s)} />
        )}
      </div>

      {canWrite ? (
        <ShipmentFormSheet open={creating} onOpenChange={setCreating} />
      ) : null}

      <ShipmentDetailSheet
        shipment={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </div>
  );
}
