"use client";

import { useTranslations } from "next-intl";
import { Bell, LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";
import { useMe } from "@/hooks/use-me";
import { useRouter } from "@/i18n/routing";

/**
 * Sidebar footer — faithful port of `.sb-foot` / `.sb-bell` /
 * `.sb-foot-name` / `.sb-foot-role` from the design source.
 *
 *   .sb-foot         padding 12, gap 10, border-top white/5
 *   .sb-foot-name    12.5px, color #f5efe0, line-height 1.2
 *   .sb-foot-role    10.5px, uppercase, tracking .04em, cream/.55
 *   .sb-bell         32×32, radius 8, transparent until hover
 *   .sb-bell-badge   accent bg, 10px mono on white, top-right of bell
 */
export function SidebarFooter() {
  const t = useTranslations("appShell");
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data } = useMe();

  const displayName = data?.user?.display_name ?? user?.displayName ?? user?.email ?? "";
  const email = data?.user?.email ?? user?.email ?? "";
  const roleName = data?.role?.name ?? "";
  const initials = (displayName || email || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-2.5 p-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0"
          >
            <div
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-[#2563eb] font-serif text-[11px] font-semibold leading-none text-white [box-shadow:inset_0_0_0_1px_rgba(255,255,255,.1)]"
            >
              {initials || "?"}
            </div>
            <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-[12.5px] leading-[1.2] text-[#f5efe0]">
                {displayName || t("noName")}
              </span>
              <span className="mt-[2px] truncate text-[10.5px] uppercase leading-none tracking-[0.04em] text-[rgb(217_210_194_/_0.55)]">
                {roleName || email}
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="min-w-[220px]">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{displayName || t("noName")}</span>
            {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/settings")}>
            <UserIcon className="size-4" />
            {t("profile")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/settings")}>
            <SettingsIcon className="size-4" />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOut className="size-4" />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        aria-label={t("notifications")}
        className="relative grid size-8 shrink-0 place-items-center rounded-lg border border-transparent text-[rgb(245_239_224_/_0.7)] transition-colors hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-[#f5efe0] group-data-[collapsible=icon]:hidden"
      >
        <Bell className="size-[15px]" strokeWidth={1.75} />
        <span className="absolute right-[3px] top-[3px] grid h-[14px] min-w-[14px] place-items-center rounded-full bg-[#2563eb] px-1 font-mono text-[10px] font-semibold leading-none text-white">
          3
        </span>
      </button>
    </div>
  );
}
