"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  PrintStockEntryCreate,
  PrintStockExitCreate,
  PrintStockLevelFilters,
  PrintStockLevelPage,
  PrintStockMovementFilters,
  PrintStockMovementPage,
  PrintStockMovementRead,
} from "@/lib/schemas/print-stock";

const ROOT = "/v1/print-stock";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  // Strip nullish values so the URL doesn't carry `?key=undefined` noise.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

export function usePrintStockLevels(
  filters: PrintStockLevelFilters = {},
): UseQueryResult<PrintStockLevelPage, ApiError> {
  const api = useApi();
  return useQuery<PrintStockLevelPage, ApiError>({
    queryKey: qk.printStock.list(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<PrintStockLevelPage>(`${ROOT}/levels`, {
        query: pruneUndefined({
          q: filters.q,
          print_design_id: filters.print_design_id,
          product_color: filters.product_color,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function usePrintStockMovements(
  filters: PrintStockMovementFilters = {},
): UseQueryResult<PrintStockMovementPage, ApiError> {
  const api = useApi();
  return useQuery<PrintStockMovementPage, ApiError>({
    queryKey: [...qk.printStock.lists(), "movements", filters as Readonly<Record<string, unknown>>],
    queryFn: () =>
      api.get<PrintStockMovementPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          print_design_id: filters.print_design_id,
          product_color: filters.product_color,
          direction: filters.direction,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreatePrintStockEntry() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintStockMovementRead, ApiError, PrintStockEntryCreate>({
    mutationFn: (payload) => api.post<PrintStockMovementRead>(`${ROOT}/entries`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.printStock.all() }),
  });
}

export function useCreatePrintStockExit() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintStockMovementRead, ApiError, PrintStockExitCreate>({
    mutationFn: (payload) => api.post<PrintStockMovementRead>(`${ROOT}/exits`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.printStock.all() }),
  });
}
