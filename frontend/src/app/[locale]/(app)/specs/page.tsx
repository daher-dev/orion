"use client";

import { useState, useDeferredValue } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useSpecs } from "@/hooks/use-specs";
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
import { Can } from "@/components/Can";
import { SpecsTable } from "@/components/specs/SpecsTable";
import { SpecsEmptyState } from "@/components/specs/SpecsEmptyState";
import { SpecDetailHeader } from "@/components/specs/SpecDetailHeader";
import { FABRIC_TYPES, type FabricType } from "@/lib/schemas/spec";

export default function SpecsListPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [fabric, setFabric] = useState<"all" | FabricType>("all");
  const deferredSearch = useDeferredValue(search);

  const query = useSpecs({
    filters: {
      q: deferredSearch || undefined,
      fabric_type: fabric === "all" ? undefined : fabric,
    },
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const isFiltering = Boolean(deferredSearch) || fabric !== "all";

  return (
    <div data-testid="specs-list-page">
      <SpecDetailHeader
        eyebrow={t("specs.page.eyebrow")}
        title={t("specs.list.title")}
        sub={t("specs.list.sub")}
        actions={
          <Can permission="specs.write">
            <Button asChild data-testid="specs-new-cta">
              <Link href="/specs/new">
                <Plus className="size-3.5" /> {t("specs.actions.create")}
              </Link>
            </Button>
          </Can>
        }
      />
      <div className="overflow-hidden rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <Input
            placeholder={t("specs.filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-xs"
            data-testid="specs-search"
          />
          <Select value={fabric} onValueChange={(v) => setFabric(v as "all" | FabricType)}>
            <SelectTrigger size="sm" data-testid="specs-fabric-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("specs.filters.all")}</SelectItem>
              {FABRIC_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`specs.fabricTypes.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {query.data ? (
            <span className="ml-auto text-[12px] text-[color:var(--orion-ink-3)]">
              {total} {total === 1 ? t("specs.list.title").toLowerCase().replace(/s$/, "") : t("specs.list.title").toLowerCase()}
            </span>
          ) : null}
        </div>
        {query.isPending ? (
          <div className="space-y-2 p-4" data-testid="specs-list-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError ? (
          <div className="px-6 py-10 text-center text-[13px] text-[color:var(--status-err)]" data-testid="specs-list-error">
            {query.error.detail}
          </div>
        ) : items.length === 0 && !isFiltering ? (
          <SpecsEmptyState />
        ) : (
          <SpecsTable items={items} />
        )}
      </div>
    </div>
  );
}
