"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { useApi } from "@/hooks/use-api";
import type { ApiError } from "@/lib/api-client";
import type { MemberPage, MemberRead, MemberRoleUpdate } from "@/lib/schemas/member";
import { qk } from "@/lib/query-keys";

export function useMembers(): UseQueryResult<MemberPage, ApiError> {
  const api = useApi();
  return useQuery<MemberPage, ApiError>({
    queryKey: qk.members.list({}),
    queryFn: () => api.get<MemberPage>("/v1/members"),
  });
}

export function useMember(id: string | null): UseQueryResult<MemberRead, ApiError> {
  const api = useApi();
  return useQuery<MemberRead, ApiError>({
    queryKey: qk.members.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<MemberRead>(`/v1/members/${id}`),
  });
}

export function useUpdateMemberRole() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<MemberRead, ApiError, { id: string; payload: MemberRoleUpdate }>({
    mutationFn: ({ id, payload }) => api.patch<MemberRead>(`/v1/members/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.members.lists() });
      qc.invalidateQueries({ queryKey: qk.members.detail(vars.id) });
    },
  });
}

export function useRemoveMember() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members.lists() });
    },
  });
}
