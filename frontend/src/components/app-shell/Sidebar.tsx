"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navSections } from "./NavConfig";
import { useMe } from "@/hooks/use-me";

/**
 * Left navigation. Items the user lacks permission for are hidden entirely
 * (per the design spec — "hidden items don't render"). Settings sub-tree
 * enforces its own visibility deeper.
 */
export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { data } = useMe();
  const permissions = data?.permissions ?? [];

  return (
    <ShadSidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-2 text-sidebar-foreground"
        >
          <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-serif text-lg">
            O
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="font-serif text-base">Orion</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => {
          const visible = section.items.filter(
            (item) => !item.permission || permissions.includes(item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={section.titleKey}>
              <SidebarGroupLabel>{t(section.titleKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={t(item.labelKey)}>
                          <Link href={item.href}>
                            <Icon />
                            <span>{t(item.labelKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </ShadSidebar>
  );
}
