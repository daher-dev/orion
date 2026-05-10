"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySwitcher } from "./CompanySwitcher";
import { CommandPalette } from "./CommandPalette";
import { UserMenu } from "./UserMenu";

/**
 * Top app bar. Layout: sidebar trigger, company switcher, search trigger
 * (opens the command palette), notifications stub, user avatar menu.
 */
export function Topbar() {
  const t = useTranslations("topbar");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl-K to open the command palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger className="-ml-1" />
      <CompanySwitcher />
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPaletteOpen(true)}
        className="ml-2 h-9 flex-1 justify-start gap-2 text-muted-foreground sm:max-w-md"
      >
        <Search className="size-4" />
        <span className="text-xs sm:text-sm">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto hidden rounded border px-1.5 font-mono text-[10px] sm:inline-block">
          ⌘K
        </kbd>
      </Button>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-9" aria-label={t("notifications")}>
          <Bell className="size-4" />
        </Button>
        <UserMenu />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
