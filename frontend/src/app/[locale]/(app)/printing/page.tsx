"use client";

import { useEffect, useState } from "react";
import { Combine, Printer, Scroll, Search, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { KanbanBoard } from "@/components/inventory/KanbanBoard";
import { PrintOrderCard } from "@/components/printing/PrintOrderCard";
import { PrintOrderStatusPill } from "@/components/printing/PrintOrderStatusPill";
import { PrintOrderTable } from "@/components/printing/PrintOrderTable";
import { PrintOrderDetailSheet } from "@/components/printing/PrintOrderDetailSheet";
import { usePrintOrders, useUpdatePrintOrder } from "@/hooks/use-print-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { PRINT_ORDER_STATUSES, type PrintOrder, type PrintOrderStatus } from "@/lib/schemas/print-order";

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

export default function PrintingPage() {
  const t = useTranslations("printOrders");
  const canRead = useCanAccess("print_orders.read");
  const canWrite = useCanAccess("print_orders.write");
  const update = useUpdatePrintOrder();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("kanban");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<PrintOrder | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = usePrintOrders({
    q: debouncedSearch || undefined,
    page_size: 100,
  });

  const rows = data?.items ?? [];
  const showEmpty = !isPending && !isError && rows.length === 0 && !debouncedSearch;

  async function handleMove(order: PrintOrder, targetStatus: string) {
    try {
      await update.mutateAsync({ id: order.id, payload: { status: targetStatus as PrintOrderStatus } });
      toast.success(t("form.toasts.updated"));
    } catch {
      toast.error(t("form.toasts.error"));
    }
  }

  if (!canRead) {
    return <p className="text-[13px] text-[color:var(--orion-ink-3)]">{t("fallback.forbidden")}</p>;
  }

  const searchBox = (
    <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
      <Search size={13} className="text-[color:var(--orion-ink-3)]" />
      <Input
        data-testid="printing-search"
        placeholder={t("filters.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
      />
    </div>
  );

  return (
    <div>
      <PageHead
        subColor="var(--brand-prod)"
        mark={<Printer size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        help={{
          icon: Printer,
          tone: "var(--brand-prod)",
          maxW: 720,
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Scroll, label: t("help.flow.roll"), sub: t("help.flow.rollSub") },
            { icon: Printer, label: t("help.flow.print"), sub: t("help.flow.printSub"), tone: "accent" },
            { icon: Stamp, label: t("help.flow.printed"), sub: t("help.flow.printedSub") },
            { icon: Combine, label: t("help.flow.assembly"), sub: t("help.flow.assemblySub"), tone: "ok" },
          ],
        }}
        actions={
          <>
            <ViewToggle value={view} onChange={setView} labels={{ kanban: t("view.kanban"), table: t("view.table") }} />
            {canWrite ? (
              <Button
                type="button"
                onClick={() => setCreating(true)}
                className={PRIMARY_BUTTON_CLASS}
                style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
              >
                <Printer size={14} strokeWidth={1.8} />
                {t("actions.create")}
              </Button>
            ) : null}
          </>
        }
      />

      {view === "table" ? (
        <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
            {searchBox}
          </div>
          {isPending ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : isError ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">{t("list.loadError")}</p>
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
              {debouncedSearch ? t("list.noResults") : t("list.empty.body")}
            </p>
          ) : (
            <PrintOrderTable rows={rows} onView={(o) => setViewing(o)} />
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">{searchBox}</div>
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
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">{t("list.loadError")}</p>
          ) : showEmpty ? (
            <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-14 text-center text-[color:var(--orion-ink-3)]">
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)]">
                <Printer size={24} strokeWidth={1.6} />
              </div>
              <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("list.empty.title")}</h3>
              <p className="mx-auto max-w-[360px] text-[13px] leading-[1.5]">{t("list.empty.body")}</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">{t("list.noResults")}</p>
          ) : (
            <KanbanBoard<PrintOrder>
              testidPrefix="printing-kanban"
              columns={PRINT_ORDER_STATUSES.map((s) => ({ id: s, label: <PrintOrderStatusPill status={s} /> }))}
              items={rows}
              canMove={canWrite}
              getColumnId={(o) => o.status}
              getItemId={(o) => o.id}
              onMove={handleMove}
              renderColumnAction={(colId) =>
                colId === "pending" && canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreating(true)}
                    aria-label={t("actions.create")}
                    className="h-auto rounded-[5px] px-2 py-1 text-[12px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
                  >
                    <Printer size={12} strokeWidth={1.8} />
                  </Button>
                ) : null
              }
              renderCard={(c) => <PrintOrderCard order={c} onClick={() => setViewing(c)} />}
            />
          )}
        </>
      )}

      {canWrite ? (
        <PrintOrderDetailSheet order={null} open={creating} onOpenChange={setCreating} />
      ) : null}
      <PrintOrderDetailSheet
        order={viewing}
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
      />
    </div>
  );
}
