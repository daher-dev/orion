"use client";

import { Plug, RefreshCw, Settings2, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { Channel } from "@/lib/schemas/channel-integration";

type Props = {
  channel: Channel;
  canWrite: boolean;
  busy?: boolean;
  onConnect: (channel: string) => void;
  onDisconnect: (channel: string) => void;
  onSync: (channel: string) => void;
};

function initials(label: string): string {
  return label
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Relative "x min ago" string for a sync timestamp, localized via i18n. */
function useRelativeSync() {
  const t = useTranslations("settings.integrations");
  return (iso: string | null | undefined): string => {
    if (!iso) return t("never");
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return t("never");
    const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (diffMin < 1) return t("syncJustNow");
    if (diffMin < 60) return t("syncMinutesAgo", { count: diffMin });
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return t("syncHoursAgo", { count: diffH });
    return t("syncDaysAgo", { count: Math.round(diffH / 24) });
  };
}

export function IntegrationCard({
  channel,
  canWrite,
  busy = false,
  onConnect,
  onDisconnect,
  onSync,
}: Props) {
  const t = useTranslations("settings.integrations");
  const relativeSync = useRelativeSync();
  const isConnected = channel.status === "connected";

  return (
    <div
      data-testid={`integration-card-${channel.channel}`}
      data-status={channel.status}
      className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="grid size-11 flex-shrink-0 place-items-center rounded-[10px] font-serif text-[16px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15),0_2px_6px_-2px_rgba(31,27,21,0.18)]"
          style={{ background: channel.color, color: channel.fg }}
        >
          {initials(channel.label)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[15px] font-medium tracking-[-0.005em] text-[color:var(--orion-ink)]">
            {channel.label}
          </div>
          <div className="text-[11.5px] text-[color:var(--orion-ink-3)]">
            {channel.description}
          </div>
        </div>
      </div>

      {isConnected && channel.external_account_id ? (
        <div
          className="rounded-[6px] bg-[color:var(--orion-bg)] px-[10px] py-[7px] text-[11.5px] tabular-nums text-[color:var(--orion-ink-2)]"
          style={{ borderLeft: `2px solid ${channel.color}` }}
        >
          {t("account", { id: channel.external_account_id })}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2">
        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
            <span
              aria-hidden
              className="size-[7px] rounded-full bg-[color:var(--status-ok,#16a34a)] shadow-[0_0_0_3px_color-mix(in_oklab,var(--status-ok,#16a34a)_22%,transparent)]"
            />
            {t("syncedAgo", { ago: relativeSync(channel.last_sync_at) })}
          </span>
        ) : (
          <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">
            {t("notConnected")}
          </span>
        )}

        {canWrite ? (
          isConnected ? (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onSync(channel.channel)}
                className="h-auto gap-1.5 rounded-[6px] px-[10px] py-[6px] text-[12px]"
              >
                <RefreshCw className="size-3" />
                {t("actions.sync")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onDisconnect(channel.channel)}
                className="h-auto gap-1.5 rounded-[6px] px-[10px] py-[6px] text-[12px]"
              >
                <Unplug className="size-3" />
                {t("actions.disconnect")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => onConnect(channel.channel)}
              className="h-auto gap-1.5 rounded-[6px] px-[12px] py-[6px] text-[12px]"
            >
              <Plug className="size-3" />
              {t("actions.connect")}
            </Button>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
            <Settings2 className="size-3" />
            {t("readOnly")}
          </span>
        )}
      </div>
    </div>
  );
}
