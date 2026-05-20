"use client";

import { useState, useDeferredValue } from "react";
import { FileText, Search } from "lucide-react";
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
import { PageHead } from "@/components/page/PageHead";
import { SpecsTable } from "@/components/specs/SpecsTable";
import { SpecsEmptyState } from "@/components/specs/SpecsEmptyState";
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
      <PageHead
        subColor="var(--brand-catalog)"
        mark={<FileText size={11} strokeWidth={2.2} />}
        eyebrow={t("specs.page.eyebrow")}
        title={t("specs.list.title")}
        sub={t("specs.list.sub")}
        actions={
          <Can permission="specs.write">
            <Button
              asChild
              data-testid="specs-new-cta"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
              }}
            >
              <Link href="/specs/new">
                <FileText className="size-3.5" strokeWidth={1.8} /> {t("specs.actions.create")}
              </Link>
            </Button>
          </Can>
        }
      />
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("specs.filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
              data-testid="specs-search"
            />
          </div>
          <Select value={fabric} onValueChange={(v) => setFabric(v as "all" | FabricType)}>
            <SelectTrigger
              size="sm"
              data-testid="specs-fabric-filter"
              className="min-w-[160px]"
              aria-label={t("specs.filters.fabricType")}
            >
              <SelectValue placeholder={t("specs.filters.fabricType")} />
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
            <span className="ml-auto text-[12px] tabular-nums text-[color:var(--orion-ink-3)]">
              {total} {t("specs.filters.itemCount")}
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
