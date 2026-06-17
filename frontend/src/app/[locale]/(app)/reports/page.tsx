"use client";

import { useState } from "react";
import { BarChart3, Database, Download, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
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

/**
 * Reports page — direct port of the `Reports` page in
 * `/docs/design/source/pages/reports-settings.jsx`.
 *
 * Layout:
 *  - PageHead with the `--brand-reports` eyebrow, "Relatórios & análises" title,
 *    and a right-side action row (calendar + Export CSV) matching the design.
 *  - `Seg` segmented control (Vendas / Produção / Estoque / Custos) below.
 *  - The active tab body renders below the segmented control.
 */
export default function ReportsPage() {
  const t = useTranslations("reports");
  const [tab, setTab] = useState<string>("sales");
  const [range, setRange] = useState<ReportDateRange>(defaultRange);

  // Export CSV button is wired as a "coming soon" stub — the backend
  // endpoints do not yet expose a CSV export, but the design includes
  // the action so we keep it visible and surface a clear toast instead.
  const handleExport = () => {
    toast.message(t("actions.exportComingSoon"));
  };

  return (
    <div>
      <PageHead
        mark={<BarChart3 size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        subColor="var(--brand-reports)"
        help={{
          icon: BarChart3,
          tone: "var(--brand-reports)",
          title: t("help.title"),
          body: t.rich("help.body", helpBodyTags),
          steps: [
            { icon: Database, label: t("help.flow.data"), sub: t("help.flow.dataSub") },
            { icon: BarChart3, label: t("help.flow.reports"), sub: t("help.flow.reportsSub"), tone: "accent" },
            { icon: Lightbulb, label: t("help.flow.decisions"), sub: t("help.flow.decisionsSub"), tone: "ok" },
          ],
        }}
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            {/* .btn — matches the secondary button used in the design's
                action row next to the date chip. */}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-auto items-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
            >
              <Download size={14} strokeWidth={2.2} />
              {t("actions.exportCsv")}
            </button>
          </>
        }
      />
      <ReportTabs value={tab} onValueChange={setTab} range={range} />
    </div>
  );
}
