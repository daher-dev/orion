"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Palette, Search, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { PrintsTable } from "@/components/prints/PrintsTable";
import { PrintsEmptyState } from "@/components/prints/PrintsEmptyState";
import { PrintFormSheet } from "@/components/prints/PrintFormSheet";
import { usePrints } from "@/hooks/use-prints";
import { useCanAccess } from "@/hooks/use-permissions";
import { useRouter } from "@/i18n/routing";
import { PRINT_TECHNIQUES, type PrintTechnique } from "@/lib/schemas/print";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function PrintsPage() {
  const t = useTranslations("prints");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [technique, setTechnique] = useState<PrintTechnique | "all">("all");
  const [creating, setCreating] = useState(false);
  const canWrite = useCanAccess("prints.write");
  const debouncedSearch = useDebouncedValue(search, 200);
  const { data, isPending, isError } = usePrints({ q: debouncedSearch || undefined });

  const allRows = data?.items ?? [];
  const rows = technique === "all" ? allRows : allRows.filter((p) => p.technique === technique);
  const total = data?.total ?? 0;
  const showEmpty = !isPending && !isError && total === 0 && !debouncedSearch;

  return (
    <div>
      <PageHead
        subColor="var(--brand-catalog)"
        mark={<Palette size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        help={{
          icon: Palette,
          tone: "var(--brand-catalog)",
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: ImageIcon, label: t("help.flow.artwork"), sub: t("help.flow.artworkSub") },
            { icon: Palette, label: t("help.flow.print"), sub: t("help.flow.printSub"), tone: "accent" },
            { icon: Shirt, label: t("help.flow.applied"), sub: t("help.flow.appliedSub"), tone: "ok" },
          ],
        }}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
              }}
            >
              <Palette className="size-3.5" strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
              data-testid="prints-search"
            />
          </div>
          <Select value={technique} onValueChange={(v) => setTechnique(v as PrintTechnique | "all")}>
            <SelectTrigger
              aria-label={t("table.columns.technique")}
              className="h-auto min-w-[140px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allTechniques")}</SelectItem>
              {PRINT_TECHNIQUES.map((tech) => (
                <SelectItem key={tech} value={tech}>
                  {t(`techniques.${tech}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data ? (
            <span className="ml-auto text-[12px] tabular-nums text-[color:var(--orion-ink-3)]">
              {total} {t("filters.itemCount")}
            </span>
          ) : null}
        </div>

        {isPending ? (
          <div className="p-6">
            <div className="space-y-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          </div>
        ) : showEmpty ? (
          <PrintsEmptyState onCreate={canWrite ? () => setCreating(true) : undefined} />
        ) : (
          <PrintsTable rows={rows} onOpen={(p) => router.push(`/prints/${p.id}`)} />
        )}
      </div>

      <PrintFormSheet open={creating} onOpenChange={(o) => setCreating(o)} />
    </div>
  );
}
