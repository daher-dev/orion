"use client";

import { useEffect, useState } from "react";
import { Factory, PackageCheck, Scissors, Search, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { ShipmentTable } from "@/components/sewing/ShipmentTable";
import { SewingKanban } from "@/components/sewing/SewingKanban";
import { SewingEmptyState } from "@/components/sewing/SewingEmptyState";
import { ShipmentDetailSheet } from "@/components/sewing/ShipmentDetailSheet";
import { ShipmentFormSheet } from "@/components/sewing/ShipmentFormSheet";
import { useShipments } from "@/hooks/use-sewing";
import { useAvailableCuts } from "@/hooks/use-cutting";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Shipment, ShipmentStatus } from "@/lib/schemas/sewing";
import type { AvailableCut } from "@/lib/schemas/cutting";

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

type View = "kanban" | "table";
/** Status filter option — `all` is local-only, the others are wire values. */
type StatusFilter = "all" | ShipmentStatus;

/**
 * Inline segmented control matching the design's `.seg` (`/docs/design/source/styles.css`).
 */
function Seg<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  testIdPrefix,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel: string;
  testIdPrefix: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
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
            data-testid={`${testIdPrefix}-${o.value}`}
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
  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<AvailableCut | null>(null);
  const [viewing, setViewing] = useState<Shipment | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useShipments({
    q: debouncedSearch || undefined,
    status: view === "table" && status !== "all" ? status : undefined,
    page_size: 100,
  });
  // Available cuts feed the Disponível column; only needed in kanban view.
  const availableCuts = useAvailableCuts(view === "kanban" ? { page_size: 100 } : undefined);

  const rows = data?.items ?? [];
  const cuts = availableCuts.data?.items ?? [];
  const showEmpty =
    !isPending &&
    !isError &&
    rows.length === 0 &&
    cuts.length === 0 &&
    !debouncedSearch &&
    status === "all";

  if (!canRead) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  function openFromCut(cut: AvailableCut) {
    setPrefill(cut);
    setCreating(true);
  }
  function openBlank() {
    setPrefill(null);
    setCreating(true);
  }

  const viewOptions: Array<{ value: View; label: string }> = [
    { value: "kanban", label: t("view.kanban") },
    { value: "table", label: t("view.table") },
  ];
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
        help={{
          icon: Send,
          tone: "var(--brand-prod)",
          maxW: 720,
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Scissors, label: t("help.flow.cuts"), sub: t("help.flow.cutsSub") },
            { icon: Send, label: t("help.flow.shipment"), sub: t("help.flow.shipmentSub"), tone: "accent" },
            { icon: Factory, label: t("help.flow.sew"), sub: t("help.flow.sewSub") },
            { icon: PackageCheck, label: t("help.flow.blanks"), sub: t("help.flow.blanksSub"), tone: "ok" },
          ],
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Seg
              value={view}
              onChange={setView}
              options={viewOptions}
              ariaLabel={t("view.label")}
              testIdPrefix="sewing-view"
            />
            {canWrite ? (
              <Button
                type="button"
                onClick={openBlank}
                className={PRIMARY_BUTTON_CLASS}
                style={{
                  borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)",
                }}
              >
                <Send size={14} strokeWidth={1.8} />
                {t("actions.create")}
              </Button>
            ) : null}
          </div>
        }
      />

      {view === "kanban" ? (
        isPending || availableCuts.isPending ? (
          <div className="grid gap-[14px]" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-[14px]" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">
            {t("list.loadError")}
          </p>
        ) : showEmpty ? (
          <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
            <SewingEmptyState onCreate={canWrite ? openBlank : undefined} />
          </div>
        ) : (
          <SewingKanban
            cuts={cuts}
            shipments={rows}
            onView={(s) => setViewing(s)}
            onCreateFromCut={openFromCut}
            onCreate={openBlank}
            canWrite={canWrite}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
          {/* Toolbar — search + status filter (table view only). */}
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
              <Seg
                value={status}
                onChange={setStatus}
                options={statusOptions}
                ariaLabel="Status filter"
                testIdPrefix="sewing-status"
              />
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
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
              {t("list.noResults")}
            </p>
          ) : (
            <ShipmentTable rows={rows} onView={(s) => setViewing(s)} />
          )}
        </div>
      )}

      {canWrite ? (
        <ShipmentFormSheet
          open={creating}
          onOpenChange={(open) => {
            setCreating(open);
            if (!open) setPrefill(null);
          }}
          prefill={prefill}
        />
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
