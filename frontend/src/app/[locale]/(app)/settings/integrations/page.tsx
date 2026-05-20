import { Plug } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

export default async function SettingsIntegrationsPage() {
  const t = await getTranslations("settings.placeholders.integrations");
  return <SettingsPlaceholder icon={Plug} title={t("title")} body={t("body")} />;
}
