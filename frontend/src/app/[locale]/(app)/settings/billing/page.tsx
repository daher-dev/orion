"use client";

import { useTranslations } from "next-intl";
import { BillingFeaturesCard } from "@/components/settings/billing/BillingFeaturesCard";
import { BillingHero } from "@/components/settings/billing/BillingHero";
import { BillingUsageGrid } from "@/components/settings/billing/BillingUsageGrid";
import { useBillingSummary } from "@/hooks/use-billing";

/**
 * Settings → Subscription / Billing pane.
 *
 * Port of `BillingPane` from /docs/design/pages/settings.jsx. The pane has no
 * internal PageHead because the surrounding SettingsLayout already renders the
 * "Settings" header.
 *
 * Layout (matches the design source):
 *  - 18px-gap grid.
 *  - Row 1: full-width `<BillingHero/>` plan card (plan name + price + Beta pill).
 *  - Row 2: a `<BillingUsageGrid/>` (one usage card per plan limit — members,
 *    orders/month, integrations stub, storage stub).
 *  - Row 3: `<BillingFeaturesCard/>` feature checklist.
 *
 * Data: `useBillingSummary()` → `GET /v1/billing/summary` returns the resolved
 * plan, live usage vs. limits, and an (empty) invoice stub. While the query is
 * pending we render the hero/grid with empty/default values so the layout
 * doesn't jump.
 */
export default function SettingsBillingPage() {
  const t = useTranslations("settings.billing");
  const { data, isPending } = useBillingSummary();

  const planName = data?.plan.name ?? "";
  const price = data?.plan.price;
  const usage = data?.usage ?? [];

  return (
    <section className="grid gap-[18px]" aria-label={t("title")} aria-busy={isPending || undefined}>
      <BillingHero planName={planName} price={price} />
      <BillingUsageGrid usage={usage} />
      <BillingFeaturesCard planName={planName} />
    </section>
  );
}
