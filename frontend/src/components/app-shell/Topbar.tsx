"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette } from "./CommandPalette";

/**
 * Top app bar. Per design: sidebar trigger on the left, an inviting search
 * pill in the middle ("O que vamos fazer agora?"), and nothing else.
 * Company switcher + user menu + notifications all live in the sidebar.
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1 text-foreground/70 hover:text-foreground" />
      <Button
        variant="outline"
        onClick={() => setPaletteOpen(true)}
        className="h-9 max-w-[520px] flex-1 justify-start gap-2 bg-background text-muted-foreground hover:border-ring/40"
      >
        <Search className="size-4" />
        <span className="text-sm">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto rounded border border-border bg-card px-1.5 font-mono text-[10.5px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <div className="flex-1" />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
