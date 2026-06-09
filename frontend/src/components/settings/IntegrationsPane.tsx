"use client";

import { PlugZap, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationCard } from "@/components/settings/IntegrationCard";
import {
  useChannelIntegrations,
  useConnectChannel,
  useDisconnectChannel,
  useSyncChannel,
} from "@/hooks/use-channel-integrations";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Channel } from "@/lib/schemas/channel-integration";

const CARD_CLASS =
  "overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]";

/** Order the grouped sections appear in (mirrors settings.jsx). */
const GROUP_ORDER = ["Marketplaces", "Logística", "Comunicação", "IA"];

export function IntegrationsPane() {
  const t = useTranslations("settings.integrations");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("integrations.read");
  const canWrite = useCanAccess("integrations.write");

  const { data, isPending, isError, error } = useChannelIntegrations();
  const connect = useConnectChannel();
  const disconnect = useDisconnectChannel();
  const sync = useSyncChannel();

  const busy = connect.isPending || disconnect.isPending || sync.isPending;

  if (!canRead) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {tForbidden("integrations")}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="grid gap-[22px]">
        <Skeleton className="h-[68px] rounded-[14px]" />
        <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[140px] rounded-[14px]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {error?.detail ?? t("loadError")}
      </div>
    );
  }

  const handleConnect = async (channel: string) => {
    try {
      const res = await connect.mutateAsync(channel);
      // Redirect the browser to the provider's OAuth screen. In stub mode the
      // backend marks `connected` and the URL is harmless; we surface it so the
      // operator can complete the flow.
      if (res.authorization_url) {
        toast.success(t("connectStarted"), { description: res.authorization_url });
        if (typeof window !== "undefined") {
          window.open(res.authorization_url, "_blank", "noopener,noreferrer");
        }
      }
    } catch (err) {
      toast.error(t("connectError"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDisconnect = async (channel: string) => {
    try {
      await disconnect.mutateAsync(channel);
      toast.success(t("disconnected"));
    } catch (err) {
      toast.error(t("disconnectError"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleSync = async (channel: string) => {
    try {
      const res = await sync.mutateAsync(channel);
      toast.success(t("syncDone", { count: res.imported }));
    } catch (err) {
      toast.error(t("syncError"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  // Group channels, preserving the design's section order; append any
  // unexpected groups (forward-compat) after the known ones.
  const groups = new Map<string, Channel[]>();
  for (const item of data.items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  const orderedGroups = [
    ...GROUP_ORDER.filter((g) => groups.has(g)),
    ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g)),
  ];

  return (
    <div className="grid gap-[22px]">
      {/* Summary header */}
      <div
        className={`${CARD_CLASS} flex flex-wrap items-center gap-[18px] px-[20px] py-[16px]`}
      >
        <div className="flex flex-1 items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[10px] bg-[color:var(--accent-soft,color-mix(in_oklab,var(--brand-settings)_14%,transparent))] text-[color:var(--brand-settings)]">
            <PlugZap className="size-[17px]" />
          </span>
          <div>
            <div className="font-serif text-[16px] text-[color:var(--orion-ink)]">
              {t.rich("summary", {
                connected: data.connected,
                total: data.total,
                b: (chunks) => <b className="tabular-nums">{chunks}</b>,
              })}
            </div>
            <div className="text-[12px] text-[color:var(--orion-ink-3)]">
              {t("summarySub")}
            </div>
          </div>
        </div>
        {canWrite ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              const firstConnected = data.items.find((i) => i.status === "connected");
              if (firstConnected) {
                void handleSync(firstConnected.channel);
              } else {
                toast.message(t("nothingToSync"));
              }
            }}
            className="h-auto gap-1.5 rounded-[6px] px-[13px] py-[7px] text-[13px]"
          >
            <RefreshCw className="size-[13px]" />
            {t("syncAll")}
          </Button>
        ) : null}
      </div>

      {/* Grouped channel sections */}
      {orderedGroups.map((group) => {
        const items = groups.get(group) ?? [];
        if (items.length === 0) return null;
        const active = items.filter((i) => i.status === "connected").length;
        return (
          <div key={group}>
            <div className="mb-2.5 flex items-center gap-3 px-0.5">
              <span className="font-serif text-[17px] font-medium text-[color:var(--orion-ink)]">
                {group}
              </span>
              <span className="h-px flex-1 bg-[color:var(--orion-line-soft)]" />
              <span className="text-[11px] tabular-nums text-[color:var(--orion-ink-3)]">
                {t("groupActive", { active, total: items.length })}
              </span>
            </div>
            <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <IntegrationCard
                  key={item.channel}
                  channel={item}
                  canWrite={canWrite}
                  busy={busy}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onSync={handleSync}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
