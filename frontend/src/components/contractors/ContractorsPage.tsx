"use client";

import { useEffect, useMemo, useState } from "react";
import { Factory, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanAccess } from "@/hooks/use-permissions";
import { useContractors } from "@/hooks/use-contractors";
import type { Contractor } from "@/lib/schemas/contractor";
import { PageHead } from "@/components/page/PageHead";
import { ContractorsGrid } from "./ContractorsGrid";
import { ContractorDetailSheet } from "./ContractorDetailSheet";
import { ContractorsEmptyState } from "./ContractorsEmptyState";
import { ContractorFormSheet } from "./ContractorFormSheet";

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]";

export function ContractorsPage() {
  const t = useTranslations("contractors");
  const canRead = useCanAccess("contractors.read");
  const canWrite = useCanAccess("contractors.write");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [viewing, setViewing] = useState<Contractor | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const filters = useMemo(
    () => ({ q: debouncedSearch || undefined, page_size: 100 }),
    [debouncedSearch],
  );

  const { data, isPending, isError } = useContractors(filters);

  const items = data?.items ?? [];
  const hasItems = items.length > 0;

  function handleOpenCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function handleOpenEdit(contractor: Contractor) {
    setEditing(contractor);
    setSheetOpen(true);
  }

  function handleView(contractor: Contractor) {
    setViewing(contractor);
  }

  function handleSheetChange(next: boolean) {
    setSheetOpen(next);
    if (!next) setEditing(null);
  }

  if (!canRead) {
    return (
      <p
        data-testid="contractors-forbidden"
        className="text-[13px] text-[color:var(--orion-ink-3)]"
      >
        {t("fallback.forbidden")}
      </p>
    );
  }

  return (
    <div data-testid="contractors-page" className="flex flex-col">
      <PageHead
        subColor="var(--brand-prod)"
        eyebrow={t("page.eyebrow")}
        mark={<Factory size={11} strokeWidth={2.2} />}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          canWrite ? (
            <Button
              data-testid="contractors-create-cta"
              className={PRIMARY_BUTTON_CLASS}
              style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
              onClick={handleOpenCreate}
            >
              <Factory size={14} strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      {/* Search row — outside the grid since each card is its own surface. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)]"
          style={{ padding: "5px 10px" }}
        >
          <Search size={13} strokeWidth={1.8} style={{ color: "var(--orion-ink-3)" }} />
          <Input
            data-testid="contractors-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            className="h-auto border-0 bg-transparent px-0 py-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      {isError ? (
        <p
          className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] text-center text-[13px] text-[color:var(--status-err)]"
          style={{ padding: "32px 16px" }}
        >
          {t("toast.error")}
        </p>
      ) : isPending ? (
        <div className="grid" style={{ gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[140px] w-full rounded-[14px]" />
          ))}
        </div>
      ) : hasItems ? (
        <ContractorsGrid data={items} onView={handleView} />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
          <ContractorsEmptyState onCreate={handleOpenCreate} />
        </div>
      )}

      {canWrite ? (
        <ContractorFormSheet
          open={sheetOpen}
          contractor={editing}
          onOpenChange={handleSheetChange}
        />
      ) : null}

      <ContractorDetailSheet
        contractor={viewing}
        open={viewing !== null}
        onOpenChange={(o) => {
          if (!o) setViewing(null);
        }}
        onEdit={(c) => {
          setViewing(null);
          handleOpenEdit(c);
        }}
      />
    </div>
  );
}
