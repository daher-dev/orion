"use client";

import { useState } from "react";
import { CornerUpLeft, Layers, LayoutGrid, Package, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { BatchesTable } from "@/components/batches/BatchesTable";
import { CreateBatchDialog } from "@/components/batches/CreateBatchDialog";
import { useBatches } from "@/hooks/use-batches";
import { useCanAccess } from "@/hooks/use-permissions";

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

export default function BatchesPage() {
  const t = useTranslations("batches");
  const canRead = useCanAccess("orders.read");
  const canWrite = useCanAccess("orders.write");
  const [creating, setCreating] = useState(false);

  const { data, isPending, isError } = useBatches({ page_size: 50 });
  const rows = data?.items ?? [];

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
        mark={<Package size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        help={{
          icon: Layers,
          tone: "var(--brand-sales)",
          maxW: 720,
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Package, label: t("help.flow.pieces"), sub: t("help.flow.piecesSub") },
            { icon: LayoutGrid, label: t("help.flow.nest"), sub: t("help.flow.nestSub"), tone: "accent" },
            { icon: Printer, label: t("help.flow.print"), sub: t("help.flow.printSub") },
            { icon: CornerUpLeft, label: t("help.flow.back"), sub: t("help.flow.backSub"), tone: "ok" },
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
              <Package size={14} strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
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
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("list.empty")}
          </p>
        ) : (
          <BatchesTable rows={rows} />
        )}
      </div>

      {canWrite ? (
        <CreateBatchDialog open={creating} onOpenChange={setCreating} />
      ) : null}
    </div>
  );
}
