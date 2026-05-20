import { getTranslations } from "next-intl/server";
import { BillingFeaturesCard } from "@/components/settings/billing/BillingFeaturesCard";
import { BillingHero } from "@/components/settings/billing/BillingHero";
import { BillingUsageCard } from "@/components/settings/billing/BillingUsageCard";

/**
 * Settings → Subscription / Billing pane.
 *
 * Direct port of `BillingPane` from /docs/design/source/pages/settings.jsx
 * (lines ~412-485). The pane has no internal PageHead because the surrounding
 * SettingsLayout already renders the "Settings" header.
 *
 * Layout (matches the design source exactly):
 *  - 18px-gap grid.
 *  - Row 1: full-width `<BillingHero/>` plan card (gradient surface, halo,
 *    sparkles eyebrow, 42px Fraunces plan name, Beta pill, body copy).
 *  - Row 2: 2-column grid via `auto-fit minmax(280px, 1fr)` — `<BillingUsageCard/>`
 *    (members count + progress bar) on the left and `<BillingFeaturesCard/>`
 *    (feature checklist) on the right. Collapses to a single column below
 *    ~600px container width.
 *
 * Backend status:
 *  - There is no billing backend yet. Plan name + member cap come from the
 *    same `SETTINGS_DATA.plan` seed the design source uses ("Pro" / 10 seats
 *    / Beta pill). Feature list lives in i18n so we can localize it.
 *  - The member *count* (left card) is wired to the existing `useMembers`
 *    hook — it shows the real number of members in the company, not the
 *    seed of 5. When the billing backend exposes per-plan caps, swap
 *    `maxMembers` for the real value.
 */
const PLAN_NAME = "Pro";
const MAX_MEMBERS = 10;

export default async function SettingsBillingPage() {
  // Lightweight a11y region label so screen readers know what pane this is.
  const t = await getTranslations("settings.billing");

  return (
    <section className="grid gap-[18px]" aria-label={t("title")}>
      <BillingHero planName={PLAN_NAME} />
      {/* `auto-fit minmax(280px, 1fr)` grid — exact rule from the design
          source so the two cards stack on narrow viewports and live side by
          side once the pane is wide enough. */}
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <BillingUsageCard maxMembers={MAX_MEMBERS} />
        <BillingFeaturesCard planName={PLAN_NAME} />
      </div>
    </section>
  );
}
