"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import type {
  FabricMovementCreate,
  FabricMovementFilters,
  FabricMovementPage,
  FabricMovementRead,
  FabricRoll,
  FabricRollFilters,
  FabricRollFormPayload,
  FabricRollPage,
} from "@/lib/schemas/fabric";

const ROOT = "/v1/fabric";

function pruneUndefined<T extends Record<string, unknown>>(
  input: T,
): Record<string, string | number | boolean> {
  // Strip nullish/empty values so the URL doesn't carry `?key=undefined` noise.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

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

export function useFabricMovements(
  filters: FabricMovementFilters = {},
): UseQueryResult<FabricMovementPage, ApiError> {
  const api = useApi();
  return useQuery<FabricMovementPage, ApiError>({
    queryKey: qk.fabric.movements(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<FabricMovementPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          fabric_roll_id: filters.fabric_roll_id,
          kind: filters.kind,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreateFabricMovement() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<FabricMovementRead, ApiError, FabricMovementCreate>({
    mutationFn: (payload) => api.post<FabricMovementRead>(`${ROOT}/movements`, payload),
    onSuccess: () => {
      // A manual movement mutates the roll's current_weight_kg AND appends a
      // ledger row, so refresh both the roll list and the movements view.
      qc.invalidateQueries({ queryKey: qk.fabric.all() });
      qc.invalidateQueries({ queryKey: qk.fabric.movements() });
    },
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
