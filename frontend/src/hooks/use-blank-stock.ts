"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  BlankMovementCreate,
  BlankMovementFilters,
  BlankMovementPage,
  BlankMovementRead,
  BlankPieceCreate,
  BlankPieceLevelFilters,
  BlankPieceLevelPage,
  BlankPieceLevelRead,
  BlankPieceLevelSummary,
} from "@/lib/schemas/blank-stock";

const ROOT = "/v1/blank-stock";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  // Strip nullish/empty values so the URL doesn't carry `?key=undefined` noise.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

export function useBlankStockLevels(
  filters: BlankPieceLevelFilters = {},
): UseQueryResult<BlankPieceLevelPage, ApiError> {
  const api = useApi();
  return useQuery<BlankPieceLevelPage, ApiError>({
    queryKey: qk.blankStock.levels(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<BlankPieceLevelPage>(`${ROOT}/levels`, {
        query: pruneUndefined({
          q: filters.q,
          spec_id: filters.spec_id,
          size: filters.size,
          low_stock_only: filters.low_stock_only,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useBlankStockLevelsSummary(): UseQueryResult<BlankPieceLevelSummary, ApiError> {
  const api = useApi();
  return useQuery<BlankPieceLevelSummary, ApiError>({
    queryKey: qk.blankStock.levelsSummary(),
    queryFn: () => api.get<BlankPieceLevelSummary>(`${ROOT}/levels/summary`),
  });
}

export function useBlankStockMovements(
  filters: BlankMovementFilters = {},
): UseQueryResult<BlankMovementPage, ApiError> {
  const api = useApi();
  return useQuery<BlankMovementPage, ApiError>({
    queryKey: qk.blankStock.movements(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<BlankMovementPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          blank_piece_id: filters.blank_piece_id,
          kind: filters.kind,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreateBlankMovement() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<BlankMovementRead, ApiError, BlankMovementCreate>({
    mutationFn: (payload) => api.post<BlankMovementRead>(`${ROOT}/movements`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.blankStock.all() }),
  });
}

export function useCreateBlankPiece() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<BlankPieceLevelRead, ApiError, BlankPieceCreate>({
    mutationFn: (payload) => api.post<BlankPieceLevelRead>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.blankStock.all() }),
  });
}
