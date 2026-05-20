import { CreditCard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

export default async function SettingsBillingPage() {
  const t = await getTranslations("settings.placeholders.billing");
  return <SettingsPlaceholder icon={CreditCard} title={t("title")} body={t("body")} />;
}
