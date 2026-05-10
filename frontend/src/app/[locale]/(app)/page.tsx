import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dashboard placeholder. F-015 will replace this with a real dashboard.
 * For now we render two cards inside the app shell to confirm the warm
 * tokens are wired up correctly.
 */
export default function HomePage() {
  const t = useTranslations("home");
  const tDash = useTranslations("dashboard");

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tDash("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("subtitle")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("subtitle")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
