"use client";

import { useEffect, useState } from "react";
import { Megaphone, Search, Shirt, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { AdsTable } from "@/components/ads/AdsTable";
import { AdsEmptyState } from "@/components/ads/AdsEmptyState";
import { AdFormSheet } from "@/components/ads/AdFormSheet";
import { useAds } from "@/hooks/use-ads";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Ad } from "@/lib/schemas/ad";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

export default function AdsPage() {
  const t = useTranslations("ads");
  const canRead = useCanAccess("ads.read");
  const canWrite = useCanAccess("ads.write");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useAds({
    q: debouncedSearch || undefined,
    page_size: 100,
  });

  const rows = data?.items ?? [];
  const showEmpty =
    !isPending && !isError && rows.length === 0 && !debouncedSearch;

  if (!canRead) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  return (
    <div>
      <PageHead
        subColor="var(--brand-sales)"
        mark={<Megaphone size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        help={{
          icon: Megaphone,
          tone: "var(--brand-sales)",
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Shirt, label: t("help.flow.products"), sub: t("help.flow.productsSub") },
            { icon: Megaphone, label: t("help.flow.ad"), sub: t("help.flow.adSub"), tone: "accent" },
            { icon: ShoppingBag, label: t("help.flow.order"), sub: t("help.flow.orderSub"), tone: "ok" },
          ],
        }}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              className={PRIMARY_BUTTON_CLASS}
              style={{
                borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)",
              }}
            >
              <Megaphone size={14} strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        {/* .toolbar — surface bg, line-soft border-b, padding 12 16, gap 8. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search size={13} className="text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>
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
        ) : showEmpty ? (
          <AdsEmptyState onCreate={() => setCreating(true)} />
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("list.noResults")}
          </p>
        ) : (
          <AdsTable rows={rows} onEdit={(ad) => setEditing(ad)} />
        )}
      </div>

      {canWrite ? (
        <>
          <AdFormSheet open={creating} onOpenChange={setCreating} />
          <AdFormSheet
            open={editing !== null}
            initial={editing}
            onOpenChange={(o) => {
              if (!o) setEditing(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
