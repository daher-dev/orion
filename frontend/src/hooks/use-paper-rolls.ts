"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  PaperMovementCreate,
  PaperMovementFilters,
  PaperMovementPage,
  PaperMovementRead,
  PaperRoll,
  PaperRollConsume,
  PaperRollCreate,
  PaperRollFilters,
  PaperRollPage,
  PaperRollUpdate,
} from "@/lib/schemas/paper-roll";

const ROOT = "/v1/paper-rolls";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  // Strip nullish/empty values so the URL doesn't carry `?key=undefined` noise.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

export function usePaperRolls(filters: PaperRollFilters = {}): UseQueryResult<PaperRollPage, ApiError> {
  const api = useApi();
  return useQuery<PaperRollPage, ApiError>({
    queryKey: qk.paperRolls.list(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<PaperRollPage>(ROOT, {
        query: pruneUndefined({
          q: filters.q,
          paper_type: filters.paper_type,
          low_stock_only: filters.low_stock_only,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function usePaperRoll(id: string | null): UseQueryResult<PaperRoll, ApiError> {
  const api = useApi();
  return useQuery<PaperRoll, ApiError>({
    queryKey: qk.paperRolls.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<PaperRoll>(`${ROOT}/${id}`),
  });
}

export function usePaperRollMovements(
  filters: PaperMovementFilters = {},
): UseQueryResult<PaperMovementPage, ApiError> {
  const api = useApi();
  return useQuery<PaperMovementPage, ApiError>({
    queryKey: qk.paperRolls.movements(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<PaperMovementPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          paper_roll_id: filters.paper_roll_id,
          kind: filters.kind,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreatePaperRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PaperRoll, ApiError, PaperRollCreate>({
    mutationFn: (payload) => api.post<PaperRoll>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paperRolls.all() }),
  });
}

export function useUpdatePaperRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PaperRoll, ApiError, { id: string; payload: PaperRollUpdate }>({
    mutationFn: ({ id, payload }) => api.patch<PaperRoll>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.paperRolls.all() });
      qc.invalidateQueries({ queryKey: qk.paperRolls.detail(variables.id) });
    },
  });
}

export function useDeletePaperRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paperRolls.all() }),
  });
}

export function useConsumePaperRoll() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PaperRoll, ApiError, { id: string; payload: PaperRollConsume }>({
    mutationFn: ({ id, payload }) => api.post<PaperRoll>(`${ROOT}/${id}/consume`, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.paperRolls.all() });
      qc.invalidateQueries({ queryKey: qk.paperRolls.detail(variables.id) });
    },
  });
}

export function useCreatePaperMovement() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PaperMovementRead, ApiError, PaperMovementCreate>({
    mutationFn: (payload) => api.post<PaperMovementRead>(`${ROOT}/movements`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paperRolls.all() }),
  });
}
