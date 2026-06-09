"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid } from "lucide-react";
import { ConsoleHead } from "@/components/console-shell/ConsoleHead";
import { SoonRibbon } from "@/components/console-shell/SoonRibbon";
import { PlanCatalog } from "@/components/console/plans/PlanCatalog";
import { useAdminPlans } from "@/hooks/use-admin";

/**
 * Console → Plans. The global Orion plan catalog, fetched from
 * `GET /v1/admin/plans` (operator-only) via `useAdminPlans()` and rendered as
 * the 4-card grid in docs/design/admin/plans.jsx through `<PlanCatalog/>`.
 *
 * Plan editing and billing economics (per-plan org counts, MRR) are not wired
 * yet — the SoonRibbon flags the catalog as read-only.
 */
export default function ConsolePlansPage() {
  const t = useTranslations("console");
  const { data } = useAdminPlans();
  const plans = data?.items ?? [];

  return (
    <div>
      <ConsoleHead
        icon={LayoutGrid}
        color="#7e5bef"
        eyebrow={t("nav.platform")}
        title={t("plans.title")}
        desc={t("plans.desc")}
      />

      <SoonRibbon className="mb-[18px]">{t("plans.ribbon")}</SoonRibbon>

      <PlanCatalog plans={plans} />
    </div>
  );
}
