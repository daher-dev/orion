"use client";

import { useState } from "react";
import { ArrowDownUp, Scroll } from "lucide-react";
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
import { PaperLedger } from "@/components/paper/PaperLedger";
import { usePaperRollMovements } from "@/hooks/use-paper-rolls";
import { PAPER_MOVEMENT_KINDS, type PaperMovementKind } from "@/lib/schemas/paper-roll";

const ALL = "__all__";

export default function PaperMovementsPage() {
  const t = useTranslations("paperRolls");
  const [kind, setKind] = useState<string>(ALL);

  const { data, isPending, isError } = usePaperRollMovements({
    kind: kind === ALL ? undefined : (kind as PaperMovementKind),
    page_size: 100,
  });

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<Scroll size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("ledger.title")}
        titleEm={t("ledger.titleEm")}
        sub={t("ledger.sub")}
        actions={
          <Button
            type="button"
            asChild
            variant="outline"
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            <Link href="/paper">
              <ArrowDownUp size={14} strokeWidth={2.2} />
              {t("list.title")}
            </Link>
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger
              data-testid="paper-movements-kind-filter"
              className="h-auto w-[170px] gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] shadow-none focus:ring-0"
            >
              <SelectValue placeholder={t("ledger.columns.reason")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("ledger.kindFilter.all")}</SelectItem>
              {PAPER_MOVEMENT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`ledger.kinds.${k}`)}
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
          <div className="px-6 py-12 text-center text-[12.5px] text-[color:var(--status-err)]">{t("toasts.error")}</div>
        ) : (
          <PaperLedger rows={data?.items ?? []} />
        )}
      </div>
    </div>
  );
}
