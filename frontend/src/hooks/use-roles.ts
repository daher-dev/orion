"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { useApi } from "@/hooks/use-api";
import type { ApiError } from "@/lib/api-client";
import type { RoleCreate, RoleList, RoleRead, RoleUpdate } from "@/lib/schemas/role";
import { qk } from "@/lib/query-keys";

export function useRoles(): UseQueryResult<RoleList, ApiError> {
  const api = useApi();
  return useQuery<RoleList, ApiError>({
    queryKey: qk.roles.list({}),
    queryFn: () => api.get<RoleList>("/v1/roles"),
  });
}

export function useRole(id: string | null): UseQueryResult<RoleRead, ApiError> {
  const api = useApi();
  return useQuery<RoleRead, ApiError>({
    queryKey: qk.roles.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<RoleRead>(`/v1/roles/${id}`),
  });
}

export function useCreateRole() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<RoleRead, ApiError, RoleCreate>({
    mutationFn: (payload) => api.post<RoleRead>("/v1/roles", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles.lists() });
    },
  });
}

export function useUpdateRole() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<RoleRead, ApiError, { id: string; payload: RoleUpdate }>({
    mutationFn: ({ id, payload }) => api.patch<RoleRead>(`/v1/roles/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.roles.lists() });
      qc.invalidateQueries({ queryKey: qk.roles.detail(vars.id) });
    },
  });
}

export function useDeleteRole() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.roles.lists() });
    },
  });
}
