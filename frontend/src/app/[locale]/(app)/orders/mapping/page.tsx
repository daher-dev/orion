"use client";

import { useEffect, useState } from "react";
import { GitMerge, Hash, Package, Search, ShoppingBag, Sparkles } from "lucide-react";
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
import { HelpCard } from "@/components/page/HelpCard";
import { MappingTable } from "@/components/mapping/MappingTable";
import { MappingProgress } from "@/components/mapping/MappingProgress";
import {
  useAcceptAll,
  useAcceptSuggestion,
  useMappingItems,
  useSetVariation,
} from "@/hooks/use-mapping";
import { useCanAccess } from "@/hooks/use-permissions";
import { MAPPING_FILTERS, type MappingFilter } from "@/lib/schemas/mapping";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export default function MappingPage() {
  const t = useTranslations("mapping");
  const canRead = useCanAccess("orders.read");
  const canWrite = useCanAccess("orders.write");

  const [filter, setFilter] = useState<MappingFilter>("pending");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const { data, isPending, isError } = useMappingItems({
    filter,
    q: debouncedSearch || undefined,
    page_size: 100,
  });

  const acceptOne = useAcceptSuggestion();
  const acceptAll = useAcceptAll();
  const setVariation = useSetVariation();

  const rows = data?.items ?? [];
  const progress = data?.progress ?? {
    total: 0,
    linked: 0,
    pending: 0,
    with_suggestion: 0,
  };

  if (!canRead) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  const handleAccept = (itemId: string) => {
    setPendingItemId(itemId);
    acceptOne.mutate(itemId, {
      onSuccess: (item) => toast.success(t("toast.accepted", { sku: item.sku ?? "" })),
      onError: () => toast.error(t("toast.error")),
      onSettled: () => setPendingItemId(null),
    });
  };

  const handleSetVariation = (itemId: string, variationId: string) => {
    setPendingItemId(itemId);
    setVariation.mutate(
      { itemId, payload: { variation_id: variationId } },
      {
        onSuccess: (item) => toast.success(t("toast.linked", { sku: item.sku ?? "" })),
        onError: () => toast.error(t("toast.error")),
        onSettled: () => setPendingItemId(null),
      },
    );
  };

  const handleAcceptAll = () => {
    acceptAll.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(t("toast.acceptedAll", { count: result.accepted })),
      onError: () => toast.error(t("toast.error")),
    });
  };

  return (
    <div>
      <PageHead
        subColor="var(--brand-sales)"
        mark={<GitMerge size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("page.title")}
        titleEm={t("page.titleEm")}
        sub={t("page.sub")}
      />

      <HelpCard
        icon={GitMerge}
        tone="var(--brand-sales)"
        title={t("help.title")}
        steps={[
          { icon: ShoppingBag, label: t("help.steps.item"), sub: t("help.steps.itemSub") },
          { icon: Hash, label: t("help.steps.sku"), sub: t("help.steps.skuSub"), accent: true },
          { icon: Package, label: t("help.steps.stock"), sub: t("help.steps.stockSub") },
        ]}
      >
        {t("help.body")}
      </HelpCard>

      <MappingProgress progress={progress} />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
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

          <Select value={filter} onValueChange={(v) => setFilter(v as MappingFilter)}>
            <SelectTrigger
              aria-label={t("filters.filter")}
              className="h-auto min-w-[160px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]"
            >
              <SelectValue placeholder={t("filters.filter")} />
            </SelectTrigger>
            <SelectContent>
              {MAPPING_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f === "pending"
                    ? t("filters.pending", { count: progress.pending })
                    : f === "linked"
                      ? t("filters.linked", { count: progress.linked })
                      : t("filters.all", { count: progress.total })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canWrite && progress.with_suggestion > 0 ? (
            <Button
              type="button"
              onClick={handleAcceptAll}
              disabled={acceptAll.isPending}
              className="ml-auto h-auto gap-1.5 rounded-[6px] bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white hover:brightness-95"
            >
              <Sparkles size={14} strokeWidth={1.8} />
              {t("actions.acceptAll", { count: progress.with_suggestion })}
            </Button>
          ) : null}
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
        ) : (
          <MappingTable
            rows={rows}
            filter={filter}
            onAccept={handleAccept}
            onSetVariation={handleSetVariation}
            pendingItemId={pendingItemId}
          />
        )}
      </div>
    </div>
  );
}
