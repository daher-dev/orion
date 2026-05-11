"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  MovementsFilters,
  MovementsPage,
  StockEntryCreate,
  StockEntryServerResponse,
  StockExitCreate,
  StockExitServerResponse,
  StockFilters,
  StockPage,
} from "@/lib/schemas/stock";

const ROOT = "/v1/stock";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  // Strip out nullish values so the URL doesn't get noisy `?key=undefined` strings.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

export function useStockLevels(
  filters: StockFilters = {},
): UseQueryResult<StockPage, ApiError> {
  const api = useApi();
  return useQuery<StockPage, ApiError>({
    queryKey: qk.stock.list(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<StockPage>(`${ROOT}/levels`, {
        query: pruneUndefined({
          q: filters.q,
          product_id: filters.product_id,
          low_stock_only: filters.low_stock_only,
          threshold: filters.threshold,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useStockMovements(
  filters: MovementsFilters = {},
): UseQueryResult<MovementsPage, ApiError> {
  const api = useApi();
  return useQuery<MovementsPage, ApiError>({
    queryKey: [...qk.stock.lists(), "movements", filters as Readonly<Record<string, unknown>>],
    queryFn: () =>
      api.get<MovementsPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          variation_id: filters.variation_id,
          date_from: filters.date_from,
          date_to: filters.date_to,
          type: filters.type,
          reason_or_source: filters.reason_or_source,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreateStockEntry() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<StockEntryServerResponse, ApiError, StockEntryCreate>({
    mutationFn: (payload) => api.post<StockEntryServerResponse>(`${ROOT}/entries`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.stock.all() }),
  });
}

export function useCreateStockExit() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<StockExitServerResponse, ApiError, StockExitCreate>({
    mutationFn: (payload) => api.post<StockExitServerResponse>(`${ROOT}/exits`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.stock.all() }),
  });
}
