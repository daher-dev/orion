"use client";

import { useEffect, useState } from "react";
import { Heart, Search, ShoppingBag, User, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { ClientsEmptyState } from "@/components/clients/ClientsEmptyState";
import { ClientFormSheet } from "@/components/clients/ClientFormSheet";
import { useClients } from "@/hooks/use-clients";
import { useCanAccess } from "@/hooks/use-permissions";
import type { ClientRead } from "@/lib/schemas/client";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function ClientsPage() {
  const t = useTranslations("clients");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClientRead | null>(null);
  const [creating, setCreating] = useState(false);
  const canWrite = useCanAccess("clients.write");
  const debouncedSearch = useDebouncedValue(search, 200);
  const { data, isPending, isError } = useClients({ q: debouncedSearch || undefined });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const showEmpty = !isPending && !isError && total === 0 && !debouncedSearch;

  return (
    <div>
      <PageHead
        subColor="var(--brand-sales)"
        mark={<Users size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        sub={t("list.sub")}
        help={{
          icon: Users,
          tone: "var(--brand-sales)",
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: ShoppingBag, label: t("help.flow.orders"), sub: t("help.flow.ordersSub") },
            { icon: User, label: t("help.flow.client"), sub: t("help.flow.clientSub"), tone: "accent" },
            { icon: Heart, label: t("help.flow.ltv"), sub: t("help.flow.ltvSub"), tone: "ok" },
          ],
        }}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              // .btn-primary in design — colored bg, white text, 7 13 padding, 13px,
              // weight 500, 6px radius, inset+outer shadow, accent-edge border.
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)",
              }}
            >
              <Users className="size-3.5" strokeWidth={1.75} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      {/* .card — surface bg, line border, 14px radius, overflow hidden. */}
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        {/* .toolbar — surface bg, line-soft border-b, padding 12 16, gap 8. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          {/* .tb-input — bg=bg, line border, 6 radius, padding 5 10, 12.5px, gap 6, min-w 180 */}
          <div className="flex min-w-[200px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>
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
          <ClientsEmptyState onCreate={() => setCreating(true)} />
        ) : (
          <ClientsTable rows={rows} onEdit={(c) => setEditing(c)} />
        )}
      </div>

      <ClientFormSheet open={creating} onOpenChange={(o) => setCreating(o)} />
      <ClientFormSheet
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        initial={editing ?? undefined}
      />
    </div>
  );
}
