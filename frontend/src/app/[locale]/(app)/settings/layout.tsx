import type { ReactNode } from "react";
import { SettingsPageHead } from "@/components/settings/SettingsPageHead";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

/**
 * Settings shell — direct port of the `Settings` page wrapper in
 * `/docs/design/source/pages/reports-settings.jsx`:
 *
 *   - `.page` 22 28 padding, max-width 1480.
 *   - PageHead with stone "Ajustes" eyebrow + "Como funciona?" help pill
 *     (rendered by the client `SettingsPageHead`).
 *   - 220px sub-nav column + 1fr content, 18px gap.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <SettingsPageHead />
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
