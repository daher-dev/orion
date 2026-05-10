import { getTranslations } from "next-intl/server";
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
        mark="A"
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        sub={t("list.sub")}
        subColor="var(--brand-settings)"
      />
      <div className="grid gap-[18px] md:grid-cols-[220px_1fr]">
        <aside>
          <SettingsSidebar />
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}
