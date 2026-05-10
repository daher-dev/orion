"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import type {
  FabricRoll,
  FabricRollFilters,
  FabricRollFormPayload,
  FabricRollPage,
} from "@/lib/schemas/fabric";

const ROOT = "/v1/fabric";

export function useFabricRolls(
  filters: FabricRollFilters = {},
): UseQueryResult<FabricRollPage, ApiError> {
  const api = useApi();
  return useQuery<FabricRollPage, ApiError>({
    queryKey: qk.fabric.list(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<FabricRollPage>(ROOT, {
        query: {
          q: filters.q,
          kind: filters.kind,
          fabric_type: filters.fabric_type,
          page: filters.page,
          page_size: filters.page_size,
        },
      }),
  });
}

export function useFabricRoll(id: string | null): UseQueryResult<FabricRoll, ApiError> {
  const api = useApi();
  return useQuery<FabricRoll, ApiError>({
    queryKey: qk.fabric.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<FabricRoll>(`${ROOT}/${id}`),
  });
}

export function useCreateFabricRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<FabricRoll, ApiError, FabricRollFormPayload>({
    mutationFn: (payload) => api.post<FabricRoll>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.fabric.all() }),
  });
}

export function useUpdateFabricRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<FabricRoll, ApiError, { id: string; payload: Partial<FabricRollFormPayload> }>({
    mutationFn: ({ id, payload }) => api.patch<FabricRoll>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.fabric.all() });
      qc.invalidateQueries({ queryKey: qk.fabric.detail(variables.id) });
    },
  });
}

export function useDeleteFabricRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.fabric.all() }),
  });
}
