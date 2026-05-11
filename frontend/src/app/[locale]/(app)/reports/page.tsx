"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHead } from "@/components/page/PageHead";
import { ReportTabs } from "@/components/reports/ReportTabs";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import type { ReportDateRange } from "@/lib/schemas/reports";

/** Default to a 90-day window, matching the design's "Últimos 90 dias" chip. */
function defaultRange(): ReportDateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { date_from: toIso(from), date_to: toIso(to) };
}

export default function ReportsPage() {
  const t = useTranslations("reports");
  const [tab, setTab] = useState<string>("sales");
  const [range, setRange] = useState<ReportDateRange>(defaultRange);

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        mark={<BarChart3 className="size-3" strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        subColor="var(--brand-reports)"
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />
      <ReportTabs value={tab} onValueChange={setTab} range={range} />
    </div>
  );
}
