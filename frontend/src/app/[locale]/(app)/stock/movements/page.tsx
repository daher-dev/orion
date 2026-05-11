"use client";

import { useState } from "react";
import { ArrowDownUp, Boxes } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHead } from "@/components/page/PageHead";
import { Link } from "@/i18n/routing";
import { MovementsTable } from "@/components/stock/MovementsTable";
import { useStockMovements } from "@/hooks/use-stock";
import { MOVEMENT_TYPES } from "@/lib/schemas/stock";

const ALL = "__all__";

export default function StockMovementsPage() {
  const t = useTranslations("stock");
  const [type, setType] = useState<string>(ALL);

  const { data, isPending, isError } = useStockMovements({
    type: type === ALL ? undefined : (type as "entry" | "exit"),
  });
  const rows = data?.items ?? [];

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<Boxes size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("movements.title")}
        titleEm={t("movements.titleEm")}
        sub={t("movements.sub")}
        actions={
          <Button
            type="button"
            asChild
            variant="outline"
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            <Link href="/stock">
              <ArrowDownUp size={14} strokeWidth={2.2} />
              {t("list.title")}
            </Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger
              data-testid="movements-type-filter"
              className="h-auto w-[160px] gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] shadow-none focus:ring-0"
            >
              <SelectValue placeholder={t("movements.columns.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("movements.types.all")}</SelectItem>
              {MOVEMENT_TYPES.map((mt) => (
                <SelectItem key={mt} value={mt}>
                  {t(`movements.types.${mt}`)}
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
        ) : isError ? (
          <div className="px-6 py-12 text-center text-[12.5px] text-[color:var(--status-err)]">
            {t("adjust.toasts.error")}
          </div>
        ) : (
          <MovementsTable data={rows} />
        )}
      </div>
    </div>
  );
}
