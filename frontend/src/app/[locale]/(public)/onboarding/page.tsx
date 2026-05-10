import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Onboarding placeholder. F-001 will replace with the company-creation +
 * invitation wizard.
 */
export default function OnboardingPage() {
  const t = useTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("onboardingTitle")}</CardTitle>
        <CardDescription>{t("onboardingSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {t("comingSoon")}
      </CardContent>
    </Card>
  );
}
