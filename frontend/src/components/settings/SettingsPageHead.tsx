"use client";

import { Plug, Settings as SettingsIcon, Shield, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";

/**
 * Settings shell header — the stone "Ajustes" `PageHead` plus its
 * "Como funciona?" help pill. Lives in a client component because the help
 * pill passes lucide icon *components* (not serialisable across the RSC
 * boundary) and renders the popover via a portal, so the parent settings
 * layout (a server component) can't build the `help` object itself.
 */
export function SettingsPageHead() {
  const t = useTranslations("settings");

  return (
    <PageHead
      mark={<SettingsIcon size={11} strokeWidth={2.2} />}
      eyebrow={t("page.eyebrow")}
      title={t("list.title")}
      sub={t("list.sub")}
      subColor="var(--brand-settings)"
      help={{
        icon: SettingsIcon,
        tone: "var(--brand-settings)",
        title: t("help.title"),
        body: t.rich("help.body", helpBodyTags),
        steps: [
          { icon: Users, label: t("help.flow.team"), sub: t("help.flow.teamSub") },
          { icon: Shield, label: t("help.flow.roles"), sub: t("help.flow.rolesSub"), tone: "accent" },
          { icon: Plug, label: t("help.flow.integrations"), sub: t("help.flow.integrationsSub"), tone: "ok" },
        ],
      }}
    />
  );
}
