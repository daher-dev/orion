"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, Search } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { CommandPalette } from "./CommandPalette";

/**
 * Top app bar — faithful port of `.topbar`, `.tb-burger`, `.tb-search` from
 * /docs/design/source/styles.css:
 *
 *   .topbar       height 56, bg surface, border-bottom line, padding 0 18,
 *                 gap 14, sticky.
 *   .tb-burger    32×32, radius 6, transparent, ink-2 → ink on hover.
 *   .tb-search    flex 1, max 520, bg paper, border line, radius 10,
 *                 padding 7 12, gap 8, color ink-3.
 *   .tb-search kbd  mono 10.5, bg surface, border line, padding 1 5, rounded 4.
 */
export function Topbar() {
  const t = useTranslations("topbar");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toggleSidebar } = useSidebar();

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
    <header
      data-orion-paper
      // .topbar — height 56, bg surface (#fbf8f2) + paper grain via the
      // shared --orion-grain layer (see globals.css), border-bottom line,
      // padding 0 18, gap 14.
      className="sticky top-0 z-30 flex h-14 items-center gap-3.5 border-b border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px]"
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        // .tb-burger — 32×32, radius 6, ink-2 → hover surface-2
        className="grid size-8 shrink-0 place-items-center rounded-md text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
      >
        <Menu className="size-[18px]" strokeWidth={1.75} />
      </button>

      {/* .tb-search */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className={
          "flex h-[34px] max-w-[520px] flex-1 items-center gap-2 rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-3 py-[7px] text-left text-[color:var(--orion-ink-3)] transition-colors " +
          "hover:border-[color:color-mix(in_oklab,var(--ring)_30%,var(--orion-line))]"
        }
      >
        <Search className="size-[14px]" strokeWidth={1.75} />
        <span className="text-[13px]">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto rounded-[4px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[5px] py-px font-mono text-[10.5px] leading-none text-[color:var(--orion-ink-3)]">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
