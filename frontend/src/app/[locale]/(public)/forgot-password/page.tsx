import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { AuthCard } from "@/components/auth/AuthCard";

/**
 * Forgot-password stub. Real password recovery requires more thought (rate
 * limiting, branded email template) and lives in a later release. The route
 * is still wired so the "Esqueceu a senha?" link from `/login` lands on a
 * dedicated, helpful page rather than a 404.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  return (
    <AuthCard title={t("title")} sub={t("comingSoon")}>
      <Link
        href="/login"
        className="self-start text-[13px] font-medium text-[color:var(--ring)] hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </AuthCard>
  );
}
