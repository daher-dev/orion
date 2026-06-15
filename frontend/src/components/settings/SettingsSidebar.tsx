"use client";

import {
  Bell,
  Boxes,
  Building2,
  CreditCard,
  History,
  Plug,
  Shield,
  SwatchBook,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";

/**
 * Left sub-nav inside the Settings page. Direct port of the panes list in
 * /docs/design/source/pages/settings.jsx (`panes` const) and the `.settings-grid`
 * aside styling in /docs/design/source/styles.css.
 *
 * Two groups — Organização (Empresa, Membros, Funções, Assinatura,
 * Integrações, Auditoria) and Conta (Perfil, Notificações). Each group has an
 * uppercase 10.5px label. Items are 13.5px rows, padding 8 12, radius
 * `--radius-sm`. Active row: surface bg + line border + tiny shadow, plus a
 * 2px stone bar at left -1, top/bottom 7. Active icon adopts the stone
 * `--brand-settings` color; inactive icons are ink-3.
 */

type Pane = {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
};

type Group = {
  id: "organization" | "personalization" | "account";
  items: readonly Pane[];
};

export const settingsGroups: readonly Group[] = [
  {
    id: "organization",
    items: [
      { id: "company", labelKey: "settings.nav.company", href: "/settings/company", icon: Building2 },
      { id: "members", labelKey: "settings.nav.members", href: "/settings/members", icon: Users },
      { id: "roles", labelKey: "settings.nav.roles", href: "/settings/roles", icon: Shield },
      { id: "billing", labelKey: "settings.nav.billing", href: "/settings/billing", icon: CreditCard },
      { id: "integrations", labelKey: "settings.nav.integrations", href: "/settings/integrations", icon: Plug },
      { id: "audit", labelKey: "settings.nav.audit", href: "/settings/audit", icon: History },
    ],
  },
  {
    id: "personalization",
    items: [
      { id: "catalog", labelKey: "settings.nav.catalog", href: "/settings/catalog", icon: SwatchBook },
      { id: "stock-alerts", labelKey: "settings.nav.stockAlerts", href: "/settings/stock-alerts", icon: Boxes },
    ],
  },
  {
    id: "account",
    items: [
      { id: "profile", labelKey: "settings.nav.profile", href: "/settings/profile", icon: User },
      { id: "notifications", labelKey: "settings.nav.notifications", href: "/settings/notifications", icon: Bell },
    ],
  },
] as const;

// Backwards-compat export — tests / consumers that grabbed the flat list still work.
export const settingsPanes: readonly Pane[] = settingsGroups.flatMap((g) => g.items);

export function SettingsSidebar() {
  const t = useTranslations();
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    // Sticky like the design's `aside` (position: sticky, top: 8px) so the
    // sub-nav follows the user as they scroll a tall pane.
    <nav aria-label="Settings sections" className="sticky top-2 flex flex-col gap-[14px]">
      {settingsGroups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {/* .group label — 10.5px / .12em tracking / uppercase / ink-3 / 600.
              Padding 4px 12px 6px from the design source. */}
          <div className="px-3 pt-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--orion-ink-3)]">
            {t(`settings.groups.${group.id}`)}
          </div>
          {group.items.map((pane) => {
            const Icon = pane.icon;
            const active = isActive(pane.href);
            return (
              <Link
                key={pane.id}
                href={pane.href}
                aria-current={active ? "page" : undefined}
                data-active={active || undefined}
                data-pane={pane.id}
                className={
                  // .pane item — gap 10px, padding 8 12, radius var(--radius-sm),
                  // 13.5px font. Inactive: ink-2, transparent border. Active:
                  // surface bg + line border + var(--shadow-sm) + ink color.
                  "group/setting-item relative mb-0.5 flex items-center gap-2.5 rounded-md border px-3 py-2 text-[13.5px] leading-none transition-colors " +
                  "border-transparent text-[color:var(--orion-ink-2)] " +
                  "hover:bg-[color:var(--orion-surface)]/60 hover:text-[color:var(--orion-ink)] " +
                  "data-[active]:border-[color:var(--orion-line)] data-[active]:bg-[color:var(--orion-surface)] data-[active]:text-[color:var(--orion-ink)] " +
                  "data-[active]:shadow-[0_1px_2px_rgba(31,27,21,.05)] " +
                  // Active accent bar: 2px wide, left: -1, top/bottom 7px,
                  // stone `--brand-settings`. Matches the design source.
                  "data-[active]:before:absolute data-[active]:before:left-[-1px] data-[active]:before:top-[7px] data-[active]:before:bottom-[7px] data-[active]:before:w-[2px] data-[active]:before:rounded-[2px] data-[active]:before:bg-[color:var(--brand-settings)] data-[active]:before:content-['']"
                }
              >
                <Icon
                  className={
                    "size-[15px] shrink-0 " +
                    (active
                      ? "text-[color:var(--brand-settings)]"
                      : "text-[color:var(--orion-ink-3)]")
                  }
                  strokeWidth={2}
                />
                <span>{t(pane.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
