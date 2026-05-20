"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarFooter as ShadSidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { bottomItems, dashboardItem, navSections, type NavItem } from "./NavConfig";
import { CompanySwitcher } from "./CompanySwitcher";
import { SidebarFooter } from "./SidebarFooter";
import { useMe } from "@/hooks/use-me";

/**
 * Left navigation, faithful port of /docs/design/source/styles.css `.sidebar`,
 * `.sb-brand`, `.sb-scroll`, `.sb-section`, `.sb-item`, `.sb-foot`.
 *
 * We keep shadcn's `<Sidebar collapsible="icon">` shell for the cookie-backed
 * collapse, responsive sheet, and keyboard handling, but render the inner
 * content with the design's exact paddings, font sizes, and colors instead of
 * shadcn's primitive defaults.
 */
export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data } = useMe();
  const permissions = data?.permissions ?? [];

  const hasPermission = (item: NavItem) => !item.permission || permissions.includes(item.permission);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const active = isActive(item.href);
    const style = { "--sub-color": item.subColor ?? "var(--sidebar-primary)" } as CSSProperties;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          data-active={active || undefined}
          style={style}
          className={
            // .sb-item — design-exact: gap 10px, padding 8px 10px, margin 1px 0,
            // radius var(--radius-sm) [6px], font-size 13.5px, color
            // rgba(217,210,194,.85), border 1px solid transparent. Active adds
            // white/6 bg, brighter cream text, and the 3px sub-color left bar
            // via ::before. Collapsed state hides the bar and centres the icon.
            "group/sb-item relative my-px flex items-center gap-2.5 rounded-sm border border-transparent px-2.5 py-2 text-[13.5px] leading-none text-[rgb(217_210_194_/_0.85)] transition-colors " +
            "hover:bg-white/[0.04] hover:text-[#f5efe0] " +
            "data-[active]:bg-white/[0.06] data-[active]:border-white/[0.06] data-[active]:text-[#f5efe0] " +
            "data-[active]:before:absolute data-[active]:before:left-[-10px] data-[active]:before:top-1.5 data-[active]:before:bottom-1.5 data-[active]:before:w-[3px] data-[active]:before:rounded-r-[3px] data-[active]:before:bg-[var(--sub-color)] data-[active]:before:content-[''] " +
            "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:before:hidden"
          }
        >
          {/*
           * Icon strokeWidth=2 matches lucide's default in the design source
           * (icons.jsx passes `strokeWidth` through unchanged, and SUBS items
           * never override it). 1.75 read too thin against the dark sidebar.
           */}
          <Icon className="size-[15px] shrink-0" strokeWidth={2} />
          <span className="group-data-[collapsible=icon]:hidden">{t(item.labelKey)}</span>
          {/*
           * .sb-count — 11px tabular-nums chip, margin-left auto, bg white/6,
           * cream/.7. Only rendered when the NavItem carries a numeric count.
           * Hidden in collapsed (icon-only) mode to match design.
           */}
          {item.count != null ? (
            <span
              className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-px text-[11px] tabular-nums leading-none text-[rgb(245_239_224_/_0.7)] group-data-[collapsible=icon]:hidden"
              aria-hidden
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      </li>
    );
  }

  return (
    <ShadSidebar
      collapsible="icon"
      className="border-r border-[#15110b]"
      style={
        {
          // Design-exact: outer container carries the linear-gradient bg,
          // inner is made transparent (via --sidebar: transparent) so the
          // gradient shows through. Foreground is the cream/.85 from design.
          "--sidebar": "transparent",
          "--sidebar-foreground": "rgb(217 210 194 / 0.85)",
          background: "linear-gradient(180deg, #1c1812 0%, #221d15 100%)",
        } as CSSProperties
      }
    >
      {/*
       * Brand band — design source: distinctly darker tone than the gradient
       * sidebar body (see Underground header in /docs/design/screenshots).
       * Solid #15110b matches the sidebar border-right value, gives the visual
       * separation between the company-switcher band and the nav.
       */}
      <SidebarHeader className="h-14 border-b border-white/5 bg-[#15110b] p-0">
        <CompanySwitcher />
      </SidebarHeader>

      <SidebarContent
        // .sb-scroll — padding 12px 10px, no gap between sections (design
        // controls vertical rhythm via `.sb-section` top-padding). Override
        // shadcn's default `gap-2` which would inject an extra 8px between
        // sections and make the menu feel loose.
        className="!gap-0 px-2.5 py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {/* Top-level: Início */}
        {hasPermission(dashboardItem) ? (
          <ul className="m-0 list-none p-0">{renderItem(dashboardItem)}</ul>
        ) : null}

        {navSections.map((section) => {
          const visible = section.items.filter(hasPermission);
          if (visible.length === 0) return null;
          return (
            <div key={section.titleKey}>
              {/* .sb-section — 10.5px uppercase, letter-spacing .12em, cream/.42 */}
              <div className="px-2.5 pt-3.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[rgb(217_210_194_/_0.42)] group-data-[collapsible=icon]:hidden">
                {t(section.titleKey)}
              </div>
              <ul className="m-0 list-none p-0">{visible.map(renderItem)}</ul>
            </div>
          );
        })}

        {/*
         * Reports + Ajustes — design source renders them inline after the
         * sections (not pinned to bottom). The `sep: true` on Reports adds a
         * 12px gap above the row, matching the `<div style={{ height: 12 }}/>`
         * spacer in shell.jsx.
         */}
        <ul className="m-0 list-none p-0 pt-3">
          {bottomItems.filter(hasPermission).map(renderItem)}
        </ul>
      </SidebarContent>

      <ShadSidebarFooter className="border-t border-white/5 p-0">
        <SidebarFooter />
      </ShadSidebarFooter>
    </ShadSidebar>
  );
}
