"use client";

import { useTranslations } from "next-intl";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/i18n/routing";
import { useMe } from "@/hooks/use-me";

/**
 * Top-bar avatar dropdown. Shows the current user, with shortcuts to the
 * profile/settings pages and a sign-out action.
 */
export function UserMenu() {
  const t = useTranslations("topbar");
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data } = useMe();

  const displayName = data?.user?.display_name ?? user?.displayName ?? user?.email ?? "";
  const email = data?.user?.email ?? user?.email ?? "";
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 rounded-full">
          <Avatar className="size-9">
            {user?.photoURL ? <AvatarImage src={user.photoURL} alt={displayName} /> : null}
            <AvatarFallback>{initials || "?"}</AvatarFallback>
          </Avatar>
          <span className="sr-only">{t("openUserMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
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
          <Settings className="size-4" />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
