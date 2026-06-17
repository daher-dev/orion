"use client";

import { useEffect, useState } from "react";
import { Combine, PackageCheck, Search, Shirt, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { BuildableCard } from "@/components/assembly/BuildableCard";
import { AssembleSheet } from "@/components/assembly/AssembleSheet";
import { useAssemble, useBuildable } from "@/hooks/use-assembly";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import type { BuildableRow } from "@/lib/schemas/assembly";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const SECONDARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

export default function AssemblyPage() {
  const t = useTranslations("assembly");
  const canRead = useCanAccess("assembly.read");
  const canWrite = useCanAccess("assembly.write");
  const assemble = useAssemble();

  const [search, setSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useBuildable({
    q: debouncedSearch || undefined,
    page_size: 100,
  });

  const rows = data?.items ?? [];

  async function handleBuild(row: BuildableRow) {
    if (row.max_buildable <= 0) return;
    try {
      const run = await assemble.mutateAsync({
        blank_piece_id: row.blank.blank_piece_id,
        printed_transfer_id: row.printed_transfer_id,
        quantity: row.max_buildable,
      });
      toast.success(t("toasts.assembled", { n: run.quantity, sku: run.sku }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const match = /(\d+)/.exec(err.detail);
        toast.error(t("toasts.insufficient", { available: match ? Number(match[1]) : 0 }));
        return;
      }
      toast.error(t("toasts.error"));
    }
  }

  if (!canRead) {
    return <p className="text-[13px] text-[color:var(--orion-ink-3)]">{t("fallback.forbidden")}</p>;
  }

  return (
    <div>
      <PageHead
        subColor="var(--brand-prod)"
        mark={<Combine size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        help={{
          icon: Combine,
          tone: "var(--brand-prod)",
          maxW: 760,
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Shirt, label: t("help.flow.blank"), sub: t("help.flow.blankSub") },
            { icon: Stamp, label: t("help.flow.printed"), sub: t("help.flow.printedSub") },
            { icon: Combine, label: t("help.flow.assembly"), sub: t("help.flow.assemblySub"), tone: "accent" },
            { icon: PackageCheck, label: t("help.flow.separation"), sub: t("help.flow.separationSub"), tone: "ok" },
          ],
        }}
        actions={
          canWrite ? (
            <Button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setManualOpen(true)}>
              <Combine size={14} strokeWidth={1.8} />
              {t("actions.manual")}
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
          <Search size={13} className="text-[color:var(--orion-ink-3)]" />
          <Input
            data-testid="assembly-search"
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Buildable assist — one "A montar" board of on-hand pairs. */}
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-3">
        <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1">
          <span className="size-2 flex-shrink-0 rounded-full" style={{ background: "var(--brand-prod)" }} />
          <span className="text-[12.5px] font-semibold text-[color:var(--orion-ink)]">{t("columns.todo")}</span>
          <span className="text-[11px] text-[color:var(--orion-ink-3)] tabular-nums">{rows.length}</span>
        </div>

        {isPending ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[150px] rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : isError ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">{t("toasts.error")}</p>
        ) : rows.length === 0 ? (
          <div
            data-testid="assembly-buildable-empty"
            className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]"
          >
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)]">
              <Combine size={24} strokeWidth={1.6} />
            </div>
            <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("empty.buildable")}</h3>
            <p className="mx-auto max-w-[360px] text-[13px] leading-[1.5]">{t("empty.buildableBody")}</p>
          </div>
        ) : (
          <div data-testid="assembly-buildable-list" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <BuildableCard
                key={`${row.printed_transfer_id}-${row.blank.blank_piece_id}`}
                row={row}
                onBuild={handleBuild}
                disabled={!canWrite || assemble.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {canWrite ? <AssembleSheet open={manualOpen} onOpenChange={setManualOpen} /> : null}
    </div>
  );
}
