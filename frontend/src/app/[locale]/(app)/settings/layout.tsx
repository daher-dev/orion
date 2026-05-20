import { getTranslations } from "next-intl/server";
import { Settings as SettingsIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHead } from "@/components/page/PageHead";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

/**
 * Settings shell — direct port of the `Settings` page wrapper in
 * `/docs/design/source/pages/reports-settings.jsx`:
 *
 *   - `.page` 22 28 padding, max-width 1480.
 *   - PageHead with stone "Ajustes" eyebrow.
 *   - 220px sub-nav column + 1fr content, 18px gap.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");

  return (
    <div>
      <PageHead
        mark={<SettingsIcon size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        sub={t("list.sub")}
        subColor="var(--brand-settings)"
      />
      {/* .settings-grid from /docs/design/source/styles.css —
          232px sub-nav column, 22px gap, collapses to 200/18 at <1100px
          and to a single column at <900px. */}
      <div className="grid items-start gap-[14px] md:gap-[18px] md:grid-cols-[200px_1fr] xl:gap-[22px] xl:grid-cols-[232px_1fr]">
        <aside>
          <SettingsSidebar />
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
