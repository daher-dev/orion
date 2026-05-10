"use client";

import { useTranslations } from "next-intl";
import { Bell, LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
 * Sidebar footer per design: avatar + name + role on the left, notifications
 * bell with badge on the right. Clicking the avatar block opens a small
 * dropdown with profile / settings / sign out. Collapses to icon-only when
 * the sidebar is collapsed.
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
    <div className="flex items-center gap-2.5 border-t border-white/5 px-3 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 text-left text-sidebar-foreground transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0"
          >
            <Avatar className="size-8 shrink-0 ring-1 ring-white/10">
              {user?.photoURL ? <AvatarImage src={user.photoURL} alt={displayName} /> : null}
              <AvatarFallback className="bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-[12.5px] text-sidebar-foreground">
                {displayName || t("noName")}
              </span>
              <span className="mt-0.5 truncate text-[10.5px] uppercase tracking-[0.04em] text-sidebar-foreground/55">
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
        className="relative grid size-8 shrink-0 place-items-center rounded-md border border-transparent text-sidebar-foreground/70 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
      >
        <Bell className="size-[15px]" />
        <span className="absolute right-0.5 top-0.5 grid min-w-[14px] place-items-center rounded-full bg-sidebar-primary px-1 font-mono text-[10px] font-semibold leading-none text-sidebar-primary-foreground">
          3
        </span>
      </button>
    </div>
  );
}
