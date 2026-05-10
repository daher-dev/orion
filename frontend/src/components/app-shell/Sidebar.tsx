"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarFooter as ShadSidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { bottomItems, dashboardItem, navSections, type NavItem } from "./NavConfig";
import { CompanySwitcher } from "./CompanySwitcher";
import { SidebarFooter } from "./SidebarFooter";
import { useMe } from "@/hooks/use-me";

/**
 * Left navigation. Mirrors the design source:
 *
 *   ┌───────────────────────────────┐
 *   │ CompanySwitcher               │  ← header (with chevron + "por Orion")
 *   ├───────────────────────────────┤
 *   │ Início                        │  ← dashboardItem (top-level)
 *   │                                │
 *   │ VENDAS                         │
 *   │   ▸ Pedidos / Clientes / Anúncios
 *   │ CATÁLOGO                       │
 *   │   ▸ Produtos / Fichas / Estampas
 *   │ ...                            │
 *   │                                │
 *   │ Relatórios / Ajustes          │  ← bottomItems (top-level, separated)
 *   ├───────────────────────────────┤
 *   │ Avatar  Nome / Cargo    🔔3   │  ← footer
 *   └───────────────────────────────┘
 *
 * Active items render a 3px colored bar on the left, using the item's
 * sub-product color (`--sub-color`).
 */
export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data } = useMe();
  const permissions = data?.permissions ?? [];

  const hasPermission = (item: NavItem) => !item.permission || permissions.includes(item.permission);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const active = isActive(item.href);
    // Expose the per-item sub-color so the menu button can render the
    // 3px left bar via ::before when active.
    const style = { "--sub-color": item.subColor ?? "var(--sidebar-primary)" } as CSSProperties;
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={t(item.labelKey)}
          style={style}
          className="relative data-[active=true]:before:absolute data-[active=true]:before:-left-2 data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-r-sm data-[active=true]:before:bg-[var(--sub-color)] data-[active=true]:before:content-[''] group-data-[collapsible=icon]:data-[active=true]:before:hidden"
        >
          <Link href={item.href}>
            <Icon className="text-[var(--sub-color)]" />
            <span>{t(item.labelKey)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <ShadSidebar collapsible="icon">
      <SidebarHeader className="border-b border-white/5 p-2">
        <CompanySwitcher />
      </SidebarHeader>

      <SidebarContent>
        {hasPermission(dashboardItem) ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>{renderItem(dashboardItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {navSections.map((section) => {
          const visible = section.items.filter(hasPermission);
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={section.titleKey}>
              <SidebarGroupLabel className="text-[10.5px] uppercase tracking-[0.12em] text-sidebar-foreground/45">
                {t(section.titleKey)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{visible.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>{bottomItems.filter(hasPermission).map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <ShadSidebarFooter className="p-0">
        <SidebarFooter />
      </ShadSidebarFooter>
    </ShadSidebar>
  );
}
