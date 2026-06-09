"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  Channel,
  ChannelList,
  ChannelSyncResult,
  ConnectStart,
} from "@/lib/schemas/channel-integration";

const BASE = "/v1/integrations/channels";

/** GET /v1/integrations/channels — catalog merged with the tenant's connections. */
export function useChannelIntegrations(): UseQueryResult<ChannelList, ApiError> {
  const api = useApi();
  return useQuery<ChannelList, ApiError>({
    queryKey: qk.integrations.channels(),
    queryFn: () => api.get<ChannelList>(BASE),
  });
}

/**
 * POST /v1/integrations/channels/{channel}/connect — start the OAuth flow.
 * Returns the authorization URL the caller should redirect the user to.
 */
export function useConnectChannel() {
  const api = useApi();
  return useMutation<ConnectStart, ApiError, string>({
    mutationFn: (channel) => api.post<ConnectStart>(`${BASE}/${channel}/connect`),
  });
}

/** POST /v1/integrations/channels/{channel}/disconnect — clear stored tokens. */
export function useDisconnectChannel() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Channel, ApiError, string>({
    mutationFn: (channel) => api.post<Channel>(`${BASE}/${channel}/disconnect`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.integrations.all() });
    },
  });
}

/** POST /v1/integrations/channels/{channel}/sync — trigger a manual sync. */
export function useSyncChannel() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<ChannelSyncResult, ApiError, string>({
    mutationFn: (channel) => api.post<ChannelSyncResult>(`${BASE}/${channel}/sync`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.integrations.all() });
    },
  });
}
