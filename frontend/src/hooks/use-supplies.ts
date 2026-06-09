"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  Supply,
  SupplyCreate,
  SupplyFilters,
  SupplyLevelFilters,
  SupplyLevelPage,
  SupplyMovementCreate,
  SupplyMovementFilters,
  SupplyMovementPage,
  SupplyMovementRead,
  SupplyPage,
  SupplyUpdate,
} from "@/lib/schemas/supply";

const ROOT = "/v1/supplies";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  // Strip nullish/empty values so the URL doesn't get noisy `?key=undefined`.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

export function useSupplies(filters: SupplyFilters = {}): UseQueryResult<SupplyPage, ApiError> {
  const api = useApi();
  return useQuery<SupplyPage, ApiError>({
    queryKey: qk.supplies.list(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<SupplyPage>(ROOT, {
        query: pruneUndefined({
          q: filters.q,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useSupply(id: string | null): UseQueryResult<Supply, ApiError> {
  const api = useApi();
  return useQuery<Supply, ApiError>({
    queryKey: qk.supplies.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Supply>(`${ROOT}/${id}`),
  });
}

export function useSupplyLevels(filters: SupplyLevelFilters = {}): UseQueryResult<SupplyLevelPage, ApiError> {
  const api = useApi();
  return useQuery<SupplyLevelPage, ApiError>({
    queryKey: qk.supplies.levels(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<SupplyLevelPage>(`${ROOT}/levels`, {
        query: pruneUndefined({
          q: filters.q,
          low_stock_only: filters.low_stock_only,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useSupplyMovements(
  filters: SupplyMovementFilters = {},
): UseQueryResult<SupplyMovementPage, ApiError> {
  const api = useApi();
  return useQuery<SupplyMovementPage, ApiError>({
    queryKey: qk.supplies.movements(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<SupplyMovementPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          supply_id: filters.supply_id,
          kind: filters.kind,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreateSupply() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Supply, ApiError, SupplyCreate>({
    mutationFn: (payload) => api.post<Supply>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.supplies.all() }),
  });
}

export function useUpdateSupply() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Supply, ApiError, { id: string; payload: SupplyUpdate }>({
    mutationFn: ({ id, payload }) => api.patch<Supply>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.supplies.all() });
      qc.invalidateQueries({ queryKey: qk.supplies.detail(variables.id) });
    },
  });
}

export function useDeleteSupply() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.supplies.all() }),
  });
}

export function useCreateSupplyMovement() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<SupplyMovementRead, ApiError, SupplyMovementCreate>({
    mutationFn: (payload) => api.post<SupplyMovementRead>(`${ROOT}/movements`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.supplies.all() }),
  });
}
