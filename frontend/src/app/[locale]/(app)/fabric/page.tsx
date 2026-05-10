"use client";

import { useEffect, useState } from "react";
import { Layers, Plus, Search } from "lucide-react";
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
import { FabricRollsTable } from "@/components/fabric/FabricRollsTable";
import { FabricRollsEmptyState } from "@/components/fabric/FabricRollsEmptyState";
import { FabricRollFormSheet } from "@/components/fabric/FabricRollFormSheet";
import { useFabricRolls } from "@/hooks/use-fabric";
import { useCanAccess } from "@/hooks/use-permissions";
import {
  FABRIC_ROLL_KINDS,
  FABRIC_TYPES,
  type FabricRoll,
  type FabricRollKind,
  type FabricType,
} from "@/lib/schemas/fabric";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const ALL = "__all__";

export default function FabricPage() {
  const t = useTranslations("fabric");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>(ALL);
  const [fabricType, setFabricType] = useState<string>(ALL);
  const [editing, setEditing] = useState<FabricRoll | null>(null);
  const [creating, setCreating] = useState(false);
  const canWrite = useCanAccess("fabric.write");
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useFabricRolls({
    q: debouncedSearch || undefined,
    kind: kind === ALL ? undefined : (kind as FabricRollKind),
    fabric_type: fabricType === ALL ? undefined : (fabricType as FabricType),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const noFilters = !debouncedSearch && kind === ALL && fabricType === ALL;
  const showEmpty = !isPending && !isError && total === 0 && noFilters;

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<Layers size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)",
              }}
            >
              <Plus className="size-3.5" strokeWidth={2.2} />
              {t("list.empty.cta")}
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
            />
          </div>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-auto w-[140px] gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] shadow-none focus:ring-0">
              <SelectValue placeholder={t("filters.kind")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.kindAll")}</SelectItem>
              {FABRIC_ROLL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`fabricRollKinds.${k}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fabricType} onValueChange={setFabricType}>
            <SelectTrigger className="h-auto w-[180px] gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] shadow-none focus:ring-0">
              <SelectValue placeholder={t("filters.fabricType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.fabricTypeAll")}</SelectItem>
              {FABRIC_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {t(`fabricTypes.${ft}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <FabricRollsEmptyState onCreate={canWrite ? () => setCreating(true) : undefined} />
        ) : (
          <FabricRollsTable data={rows} onRowClick={(roll) => setEditing(roll)} />
        )}
      </div>

      <FabricRollFormSheet open={creating} onOpenChange={(o) => setCreating(o)} />
      <FabricRollFormSheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        initial={editing ?? undefined}
      />
    </div>
  );
}
