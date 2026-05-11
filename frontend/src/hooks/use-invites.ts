"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { useApi } from "@/hooks/use-api";
import type { ApiError } from "@/lib/api-client";
import type { InviteCreate, InvitePage, InviteRead } from "@/lib/schemas/invite";
import { qk } from "@/lib/query-keys";

export function useInvites(): UseQueryResult<InvitePage, ApiError> {
  const api = useApi();
  return useQuery<InvitePage, ApiError>({
    queryKey: qk.invites.list({}),
    queryFn: () => api.get<InvitePage>("/v1/invites"),
  });
}

export function useCreateInvite() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<InviteRead, ApiError, InviteCreate>({
    mutationFn: (payload) => api.post<InviteRead>("/v1/invites", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invites.lists() });
    },
  });
}

export function useRevokeInvite() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/invites/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invites.lists() });
    },
  });
}
