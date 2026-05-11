"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useApi } from "@/hooks/use-api";
import type { ApiError } from "@/lib/api-client";
import type { RoleList, RoleRead } from "@/lib/schemas/role";
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
