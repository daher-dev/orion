"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogFiltersBar } from "@/components/settings/audit/AuditLogFiltersBar";
import { AuditLogTable } from "@/components/settings/audit/AuditLogTable";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import type { AuditLogActor } from "@/lib/schemas/audit-log";

/**
 * Settings → Audit log page (FEATURE-018).
 *
 * Lives at `/settings/audit` and surfaces the existing `AuditLog` table
 * via the `GET /v1/audit-logs` endpoint. The layout above this page (in
 * `settings/layout.tsx`) renders the stone "Ajustes" PageHead and the
 * settings sidebar; this file owns the card with filters + table +
 * pagination footer.
 */

const PAGE_SIZE = 25;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function AuditLogPage() {
  const t = useTranslations("audit");

  // Filter state. Empty string means "no filter"; the hook converts it
  // to a missing query param. Every filter setter also resets to page 1
  // so users don't land on an empty page after narrowing the result set.
  const [q, setQ] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const debouncedQ = useDebouncedValue(q, 250);

  // Wrap each setter so changing a filter resets the page to 1.
  // Doing this here (instead of via `useEffect`) keeps React 19's
  // compiler happy and avoids the cascading-render warning.
  const handleQChange = (value: string) => {
    setQ(value);
    setPage(1);
  };
  const handleResourceTypeChange = (value: string) => {
    setResourceType(value);
    setPage(1);
  };
  const handleUserIdChange = (value: string) => {
    setUserId(value);
    setPage(1);
  };
  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setPage(1);
  };
  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setPage(1);
  };

  const { data, isPending, isError, error } = useAuditLogs({
    q: debouncedQ || undefined,
    resource_type: resourceType || undefined,
    user_id: userId || undefined,
    // `<input type="date">` returns a YYYY-MM-DD string. Convert to the
    // start / end of the day so the backend's `>=` / `<=` comparisons
    // do what users expect ("everything that happened on this date").
    date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
    date_to: dateTo ? `${dateTo}T23:59:59Z` : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || resourceType || userId || dateFrom || dateTo);

  // Derive the user-filter options from whichever authors appear in the
  // visible page. Cheap and reactive; no extra endpoint required.
  const userOptions = useMemo<AuditLogActor[]>(() => {
    const seen = new Map<string, AuditLogActor>();
    for (const row of rows) {
      if (row.user && !seen.has(row.user.id)) {
        seen.set(row.user.id, row.user);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const handleClear = () => {
    setQ("");
    setResourceType("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      {/* .card-head — 14 18 padding, line-soft border-b. 16px serif title +
          12px ink-3 sub. */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("list.title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("list.sub")}
          </div>
        </div>
      </div>

      <AuditLogFiltersBar
        q={q}
        onQChange={handleQChange}
        resourceType={resourceType}
        onResourceTypeChange={handleResourceTypeChange}
        userId={userId}
        onUserIdChange={handleUserIdChange}
        userOptions={userOptions}
        dateFrom={dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={dateTo}
        onDateToChange={handleDateToChange}
        onClear={handleClear}
        canClear={hasFilters}
      />

      {isPending ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : isError ? (
        <div className="px-6 py-10 text-center text-[color:var(--orion-ink-3)]">
          {error?.detail ?? "Error"}
        </div>
      ) : total === 0 ? (
        <Empty />
      ) : (
        <AuditLogTable rows={rows} />
      )}

      {/* Pagination footer — always rendered when we have data so users
          have a stable place to look for the page indicator. */}
      {!isPending && !isError && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-4 py-3 text-[12.5px] text-[color:var(--orion-ink-3)]">
          <div data-testid="audit-pagination-status">
            {t("pagination.of", { page, total: totalPages })}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-auto gap-1 rounded-[6px] border border-transparent bg-transparent !px-[10px] py-[6px] text-[12.5px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)] disabled:opacity-50"
            >
              <ChevronLeft className="size-3.5" />
              {t("pagination.previous")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-auto gap-1 rounded-[6px] border border-transparent bg-transparent !px-[10px] py-[6px] text-[12.5px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)] disabled:opacity-50"
            >
              {t("pagination.next")}
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Empty() {
  const t = useTranslations("audit");
  return (
    // .empty — 56 24 padding, ink-3 text, .empty-mark 56×56 14-radius
    // surface-2 chip.
    <div
      className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]"
      data-testid="audit-empty"
    >
      <div className="mx-auto mb-3 inline-grid size-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-3)]">
        <History className="size-6" />
      </div>
      <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">
        {t("list.empty.title")}
      </h3>
      <p className="text-[13px]">{t("list.empty.body")}</p>
    </div>
  );
}
