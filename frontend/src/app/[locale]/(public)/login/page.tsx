import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Login placeholder. F-001 will replace with the real Firebase email +
 * Google sign-in flow.
 */
export default function LoginPage() {
  const t = useTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("comingSoon")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Button disabled>{t("signIn")}</Button>
        <Button variant="outline" disabled>
          {t("google")}
        </Button>
      </CardContent>
    </Card>
  );
}
