"use client";

import { useEffect, useState } from "react";
import { Search, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { OrdersTable } from "@/components/orders/OrdersTable";
import { OrdersEmptyState } from "@/components/orders/OrdersEmptyState";
import { OrderDetailSheet } from "@/components/orders/OrderDetailSheet";
import { OrderFormSheet } from "@/components/orders/OrderFormSheet";
import { useOrders } from "@/hooks/use-orders";
import { useCanAccess } from "@/hooks/use-permissions";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/schemas/order";
import { ECOMMERCE_CHANNELS, type Ecommerce } from "@/lib/schemas/ad";

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

export default function OrdersPage() {
  const t = useTranslations("orders");
  const canRead = useCanAccess("orders.read");
  const canWrite = useCanAccess("orders.write");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [channel, setChannel] = useState<Ecommerce | "all">("all");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Order | null>(null);
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useOrders({
    q: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    channel: channel === "all" ? undefined : channel,
    page_size: 50,
  });

  const rows = data?.items ?? [];
  const noFiltersActive =
    !debouncedSearch && status === "all" && channel === "all";
  const showEmpty = !isPending && !isError && rows.length === 0 && noFiltersActive;

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
        mark={<ShoppingBag size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              className={PRIMARY_BUTTON_CLASS}
              style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
            >
              <ShoppingBag size={14} strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        {/* .toolbar — surface bg, line-soft border-b, padding 12 16, gap 8. */}
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

          <Select
            value={status}
            onValueChange={(v) => setStatus(v as OrderStatus | "all")}
          >
            <SelectTrigger
              aria-label={t("filters.status")}
              className="h-auto min-w-[140px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]"
            >
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.statusAll")}</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`statuses.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as Ecommerce | "all")}
          >
            <SelectTrigger
              aria-label={t("filters.channel")}
              className="h-auto min-w-[140px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]"
            >
              <SelectValue placeholder={t("filters.channel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.channelAll")}</SelectItem>
              {ECOMMERCE_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`channels.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <OrdersEmptyState onCreate={() => setCreating(true)} canCreate={canWrite} />
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("list.noResults")}
          </p>
        ) : (
          <OrdersTable rows={rows} onView={(o) => setViewing(o)} />
        )}
      </div>

      {canWrite ? (
        <OrderFormSheet open={creating} onOpenChange={setCreating} navigateOnCreate />
      ) : null}

      <OrderDetailSheet
        order={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </div>
  );
}
