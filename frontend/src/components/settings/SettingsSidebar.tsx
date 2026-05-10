"use client";

import type { CSSProperties } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  History,
  Plug,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";

/**
 * Left sub-nav inside the Settings page. Direct port of the `Settings` panel
 * in `/docs/design/source/pages/reports-settings.jsx`:
 *
 *   - 220px column width (handled by the layout parent grid).
 *   - 13.5px items, gap 10px, padding 8px 12px, radius 6px.
 *   - Active item gets `--orion-surface` bg, `--orion-line` border + the
 *     stone left bar (var(--brand-settings)).
 */

type Pane = {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
};

export const settingsPanes: readonly Pane[] = [
  { id: "company", labelKey: "settings.nav.company", href: "/settings/company", icon: Building2 },
  { id: "members", labelKey: "settings.nav.members", href: "/settings/members", icon: Users },
  { id: "roles", labelKey: "settings.nav.roles", href: "/settings/roles", icon: Shield },
  { id: "billing", labelKey: "settings.nav.billing", href: "/settings/billing", icon: CreditCard },
  { id: "audit", labelKey: "settings.nav.audit", href: "/settings/audit", icon: History },
  { id: "integrations", labelKey: "settings.nav.integrations", href: "/settings/integrations", icon: Plug },
  { id: "profile", labelKey: "settings.nav.profile", href: "/settings/profile", icon: User },
  { id: "notifications", labelKey: "settings.nav.notifications", href: "/settings/notifications", icon: Bell },
] as const;

export function SettingsSidebar() {
  const t = useTranslations();
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
      {settingsPanes.map((pane) => {
        const Icon = pane.icon;
        const active = isActive(pane.href);
        return (
          <Link
            key={pane.id}
            href={pane.href}
            aria-current={active ? "page" : undefined}
            data-active={active || undefined}
            data-pane={pane.id}
            style={
              {
                "--sub-color": "var(--brand-settings)",
              } as CSSProperties
            }
            className={
              // .pane item — gap 10px, padding 8px 12px, radius 6px, font 13.5px,
              // color ink-2 (inactive) / ink (active). Active: surface bg +
              // line border; left 3px stone bar via ::before for visual anchor.
              "group/setting-item relative flex items-center gap-2.5 rounded-md border px-3 py-2 text-[13.5px] leading-none transition-colors " +
              "border-transparent text-[color:var(--orion-ink-2)] " +
              "hover:bg-[color:var(--orion-surface)]/60 hover:text-[color:var(--orion-ink)] " +
              "data-[active]:border-[color:var(--orion-line)] data-[active]:bg-[color:var(--orion-surface)] data-[active]:text-[color:var(--orion-ink)] " +
              "data-[active]:before:absolute data-[active]:before:left-[-10px] data-[active]:before:top-1.5 data-[active]:before:bottom-1.5 data-[active]:before:w-[3px] data-[active]:before:rounded-r-[3px] data-[active]:before:bg-[var(--sub-color)] data-[active]:before:content-['']"
            }
          >
            <Icon className="size-[15px] shrink-0" strokeWidth={1.75} />
            <span>{t(pane.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
