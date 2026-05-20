"use client";

import { useEffect, useState } from "react";
import { Scissors, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { CuttingTable } from "@/components/cutting/CuttingTable";
import { CuttingKanban } from "@/components/cutting/CuttingKanban";
import { CuttingEmptyState } from "@/components/cutting/CuttingEmptyState";
import { CuttingFormSheet } from "@/components/cutting/CuttingFormSheet";
import { CuttingDetailSheet } from "@/components/cutting/CuttingDetailSheet";
import { useCuttingOrders } from "@/hooks/use-cutting";
import { useCanAccess } from "@/hooks/use-permissions";
import type { CuttingOrder } from "@/lib/schemas/cutting";

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

type ViewMode = "kanban" | "table";

/**
 * Inline segmented control — direct port of `.seg` from
 * /docs/design/source/styles.css (bg-bg, 1px line border, 8px radius,
 * 2px inner padding; active button gets surface bg + tiny shadow).
 */
function ViewToggle({
  value,
  onChange,
  labels,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  labels: { kanban: string; table: string };
}) {
  const options: Array<{ value: ViewMode; label: string }> = [
    { value: "kanban", label: labels.kanban },
    { value: "table", label: labels.table },
  ];
  return (
    <div
      role="tablist"
      aria-label="View"
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

export default function CuttingPage() {
  const t = useTranslations("cutting");
  const canRead = useCanAccess("cutting.read");
  const canWrite = useCanAccess("cutting.write");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<CuttingOrder | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useCuttingOrders({
    q: debouncedSearch || undefined,
    page_size: 100,
  });

  const rows = data?.items ?? [];
  const showEmpty =
    !isPending && !isError && rows.length === 0 && !debouncedSearch;

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
        subColor="var(--brand-prod)"
        mark={<Scissors size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          <>
            <ViewToggle
              value={view}
              onChange={setView}
              labels={{ kanban: t("view.kanban"), table: t("view.table") }}
            />
            {canWrite ? (
              <Button
                type="button"
                onClick={() => setCreating(true)}
                className={PRIMARY_BUTTON_CLASS}
                style={{
                  borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)",
                }}
              >
                <Scissors size={14} strokeWidth={1.8} />
                {t("actions.create")}
              </Button>
            ) : null}
          </>
        }
      />

      {/* Search row — outside the card when we're in Kanban view, since
          Kanban columns provide their own card chrome. */}
      {view === "table" ? (
        <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
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
            <CuttingEmptyState onCreate={() => setCreating(true)} />
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
              {t("list.noResults")}
            </p>
          ) : (
            <CuttingTable rows={rows} onView={(o) => setViewing(o)} />
          )}
        </div>
      ) : (
        <>
          {/* Kanban toolbar — slimmer than the table toolbar because the
              status pills already live inside each column header. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
              <Search size={13} className="text-[color:var(--orion-ink-3)]" />
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
              />
            </div>
          </div>

          {isPending ? (
            <div className="grid grid-cols-3 gap-[14px]">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-3"
                >
                  <Skeleton className="mb-2 h-6 w-20" />
                  <Skeleton className="mb-2 h-20" />
                  <Skeleton className="h-20" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">
              {t("list.loadError")}
            </p>
          ) : showEmpty ? (
            <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
              <CuttingEmptyState onCreate={() => setCreating(true)} />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
              {t("list.noResults")}
            </p>
          ) : (
            <CuttingKanban
              rows={rows}
              onView={(o) => setViewing(o)}
              onCreate={canWrite ? () => setCreating(true) : undefined}
            />
          )}
        </>
      )}

      {canWrite ? (
        <CuttingFormSheet open={creating} onOpenChange={setCreating} />
      ) : null}
      <CuttingDetailSheet
        order={viewing}
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      />
    </div>
  );
}
