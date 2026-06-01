"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AuthCard } from "@/components/auth/AuthCard";
import { Link } from "@/i18n/routing";
import { useAuth } from "@/providers/auth-provider";

/**
 * Shown when a Firebase identity authenticates successfully but isn't on the
 * invite list (backend `POST /v1/auth/session` → 403 `not_invited`). We sign the
 * user out on mount so they don't linger half-authenticated, and offer a route
 * back to /login.
 */
export default function AccessDeniedPage() {
  const t = useTranslations("auth.accessDenied");
  const { signOut } = useAuth();

  useEffect(() => {
    void signOut();
  }, [signOut]);

  return (
    <AuthCard title={t("title")} sub={t("body")}>
      <Link
        href="/login"
        className="self-start text-[13px] font-medium text-[color:var(--ring)] hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </AuthCard>
  );
}
