"use client";

import { useTranslations } from "next-intl";
import { BarChart3, Boxes, DollarSign, Factory } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ReportDateRange } from "@/lib/schemas/reports";
import { SalesTab } from "@/components/reports/SalesTab";
import { ProductionTab } from "@/components/reports/ProductionTab";
import { InventoryTab } from "@/components/reports/InventoryTab";
import { CostsTab } from "@/components/reports/CostsTab";

type Props = {
  /** Current selected tab id. */
  value: string;
  onValueChange: (v: string) => void;
  range: ReportDateRange;
};

/**
 * 4-tab switcher for the Reports page. Mirrors the design's `<Seg/>` look
 * (sales / produção / estoque / custos) using shadcn Tabs + the `line`
 * variant — flat row, underline marker on the active tab.
 */
export function ReportTabs({ value, onValueChange, range }: Props) {
  const t = useTranslations("reports.tabs");

  return (
    <Tabs value={value} onValueChange={onValueChange} className="gap-4">
      <TabsList variant="line" className="self-start gap-3">
        <TabsTrigger value="sales">
          <BarChart3 className="size-3.5" />
          {t("sales")}
        </TabsTrigger>
        <TabsTrigger value="production">
          <Factory className="size-3.5" />
          {t("production")}
        </TabsTrigger>
        <TabsTrigger value="inventory">
          <Boxes className="size-3.5" />
          {t("inventory")}
        </TabsTrigger>
        <TabsTrigger value="costs">
          <DollarSign className="size-3.5" />
          {t("costs")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sales">
        <SalesTab range={range} />
      </TabsContent>
      <TabsContent value="production">
        <ProductionTab range={range} />
      </TabsContent>
      <TabsContent value="inventory">
        <InventoryTab range={range} />
      </TabsContent>
      <TabsContent value="costs">
        <CostsTab range={range} />
      </TabsContent>
    </Tabs>
  );
}
