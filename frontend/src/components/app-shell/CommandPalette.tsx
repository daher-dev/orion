"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useRouter } from "@/i18n/routing";
import { bottomItems, dashboardItem, navSections, type NavItem } from "./NavConfig";
import { useMe } from "@/hooks/use-me";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Global ⌘K palette. The full search is wired to /v1/search in a later wave —
 * for now we surface every nav entry the user can reach (Início, sections,
 * Relatórios, Ajustes) as quick navigation. Each row tints its icon with the
 * section's --sub-color so the palette echoes the sidebar's identity system.
 */
export function CommandPalette({ open, onOpenChange }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { data } = useMe();
  const permissions = data?.permissions ?? [];
  const [query, setQuery] = useState("");

  // Reset the query in the open-state setter rather than via a useEffect —
  // keeps state synchronized with the parent without cascading renders.
  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  function navigate(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  const hasPermission = (item: NavItem) =>
    !item.permission || permissions.includes(item.permission);

  function renderItem(item: NavItem) {
    const Icon = item.icon;
    const style = { "--sub-color": item.subColor ?? "var(--orion-ink-2)" } as CSSProperties;
    return (
      <CommandItem
        key={item.href}
        value={`${t(item.labelKey)} ${item.href}`}
        onSelect={() => navigate(item.href)}
        style={style}
      >
        {/*
         * Icon tinted with the section's sub-color (override the
         * muted-foreground default from CommandItem) so the palette
         * mirrors the sidebar's identity-per-section system.
         */}
        <Icon className="size-4 text-[color:var(--sub-color)]" strokeWidth={2} />
        {t(item.labelKey)}
      </CommandItem>
    );
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("topbar.search")}
      description={t("topbar.searchPlaceholder")}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("topbar.searchPlaceholder")}
      />
      <CommandList>
        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
        {hasPermission(dashboardItem) ? (
          <CommandGroup heading={t("appShell.commandSections.main")}>
            {renderItem(dashboardItem)}
          </CommandGroup>
        ) : null}
        {navSections.map((section) => {
          const visible = section.items.filter(hasPermission);
          if (visible.length === 0) return null;
          return (
            <CommandGroup key={section.titleKey} heading={t(section.titleKey)}>
              {visible.map(renderItem)}
            </CommandGroup>
          );
        })}
        {bottomItems.filter(hasPermission).length > 0 ? (
          <CommandGroup heading={t("appShell.commandSections.workspace")}>
            {bottomItems.filter(hasPermission).map(renderItem)}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
