import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

export default async function SettingsNotificationsPage() {
  const t = await getTranslations("settings.placeholders.notifications");
  return <SettingsPlaceholder icon={Bell} title={t("title")} body={t("body")} />;
}
