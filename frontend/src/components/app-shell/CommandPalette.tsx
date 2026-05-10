"use client";

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
import { navSections } from "./NavConfig";
import { useMe } from "@/hooks/use-me";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Global ⌘K palette. The full search is wired to /v1/search in a later wave —
 * for now we surface the user's nav items as quick navigation entries.
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

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} title={t("topbar.search")}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("topbar.searchPlaceholder")}
      />
      <CommandList>
        <CommandEmpty>{t("common.noResults")}</CommandEmpty>
        {navSections.map((section) => {
          const visible = section.items.filter(
            (item) => !item.permission || permissions.includes(item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <CommandGroup key={section.titleKey} heading={t(section.titleKey)}>
              {visible.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${t(item.labelKey)} ${item.href}`}
                    onSelect={() => navigate(item.href)}
                  >
                    <Icon className="size-4" />
                    {t(item.labelKey)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
