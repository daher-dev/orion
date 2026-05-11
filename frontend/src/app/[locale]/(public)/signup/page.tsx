import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { AuthCard } from "@/components/auth/AuthCard";

/**
 * Signup stub. Real self-service signup ships in a later release — for now we
 * route users either through the dev-bypass on `/login` or through an
 * invite-acceptance link. The stub keeps the route reachable and tells the
 * visitor what to do instead.
 */
export default function SignupPage() {
  const t = useTranslations("auth.signup");
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
