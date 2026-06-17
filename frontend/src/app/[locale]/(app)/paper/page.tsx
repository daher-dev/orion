"use client";

import { useEffect, useState } from "react";
import { Printer, Scroll, Search, Stamp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { Link } from "@/i18n/routing";
import { InventoryKpis } from "@/components/inventory/InventoryKpis";
import { PaperLedger } from "@/components/paper/PaperLedger";
import { PaperRollSheet } from "@/components/paper/PaperRollSheet";
import { PaperRollsTable } from "@/components/paper/PaperRollsTable";
import { usePaperRollMovements, usePaperRolls } from "@/hooks/use-paper-rolls";
import { useCanAccess } from "@/hooks/use-permissions";
import type { PaperRoll } from "@/lib/schemas/paper-roll";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type SheetMode = { kind: "new" } | { kind: "detail"; roll: PaperRoll };

export default function PaperRollsPage() {
  const t = useTranslations("paperRolls");
  const format = useFormatter();
  const [tab, setTab] = useState<"current" | "movements">("current");
  const [search, setSearch] = useState("");
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const canWrite = useCanAccess("paper.write");
  const debouncedSearch = useDebouncedValue(search, 200);

  const rolls = usePaperRolls({ q: debouncedSearch || undefined });
  const movements = usePaperRollMovements(tab === "movements" ? { page_size: 50 } : {});

  const rows = rolls.data?.items ?? [];
  const totalMeters = rows.reduce((sum, r) => sum + (Number(r.current_meters) || 0), 0);
  const toReorder = rows.filter((r) => r.low_stock).length;

  function openReceive() {
    setSheetMode({ kind: "new" });
    setSheetOpen(true);
  }
  function openDetail(roll: PaperRoll) {
    setSheetMode({ kind: "detail", roll });
    setSheetOpen(true);
  }

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<Scroll size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        help={{
          icon: Scroll,
          tone: "var(--brand-inv)",
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Scroll, label: t("help.flow.roll"), sub: t("help.flow.rollSub"), tone: "accent" },
            { icon: Printer, label: t("help.flow.print"), sub: t("help.flow.printSub") },
            { icon: Stamp, label: t("help.flow.printed"), sub: t("help.flow.printedSub"), tone: "ok" },
          ],
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              asChild
              variant="outline"
              className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
            >
              <Link href="/paper/movements">{t("actions.viewFullLedger")}</Link>
            </Button>
            {canWrite ? (
              <Button
                type="button"
                data-testid="paper-receive-cta"
                onClick={openReceive}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
                style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
              >
                <Scroll size={14} strokeWidth={2.2} />
                {t("actions.receiveRoll")}
              </Button>
            ) : null}
          </div>
        }
      />

      <InventoryKpis
        items={[
          {
            label: t("kpis.total"),
            value: format.number(totalMeters, { maximumFractionDigits: 0 }),
            unit: t("kpis.totalUnit"),
          },
          {
            label: t("kpis.toReorder"),
            value: toReorder,
            tone: toReorder ? "var(--status-warn)" : "var(--orion-ink)",
            hint: t("kpis.toReorderHint"),
          },
        ]}
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="inline-flex rounded-[7px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] p-0.5">
            {(["current", "movements"] as const).map((value) => (
              <button
                key={value}
                type="button"
                data-testid={`paper-tab-${value}`}
                onClick={() => setTab(value)}
                className="rounded-[5px] px-3 py-[5px] text-[12.5px] font-medium transition-colors"
                style={{
                  background: tab === value ? "var(--orion-surface)" : "transparent",
                  color: tab === value ? "var(--orion-ink)" : "var(--orion-ink-3)",
                  boxShadow: tab === value ? "0 1px 2px rgba(31,27,21,0.08)" : "none",
                }}
              >
                {t(`tabs.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              data-testid="paper-search"
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>
        </div>

        {tab === "current" ? (
          rolls.isPending ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : rolls.isError ? (
            <div className="px-6 py-12 text-center text-[12.5px] text-[color:var(--status-err)]">{t("toasts.error")}</div>
          ) : rows.length === 0 ? (
            <div data-testid="paper-empty" className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]">
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)]">
                <Scroll size={24} strokeWidth={1.6} />
              </div>
              <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("list.empty.title")}</h3>
              <p className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">{t("list.empty.body")}</p>
              {canWrite ? (
                <Button
                  onClick={openReceive}
                  data-testid="paper-empty-cta"
                  className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
                  style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
                >
                  <Scroll size={14} strokeWidth={1.8} />
                  {t("actions.receiveRoll")}
                </Button>
              ) : null}
            </div>
          ) : (
            <PaperRollsTable data={rows} onRowClick={openDetail} />
          )
        ) : movements.isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <PaperLedger rows={movements.data?.items ?? []} />
        )}
      </div>

      <PaperRollSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSheetMode(null);
        }}
        mode={sheetMode}
      />
    </div>
  );
}
