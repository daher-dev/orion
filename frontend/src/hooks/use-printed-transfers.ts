"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  PrintedMovementCreate,
  PrintedMovementFilters,
  PrintedMovementPage,
  PrintedMovementRead,
  PrintedTransferCreate,
  PrintedTransferLevelFilters,
  PrintedTransferLevelPage,
  PrintedTransferLevelRead,
} from "@/lib/schemas/printed-transfer";

const ROOT = "/v1/printed-transfers";

function pruneUndefined<T extends Record<string, unknown>>(input: T): Record<string, string | number | boolean> {
  // Strip nullish/empty values so the URL doesn't carry `?key=undefined` noise.
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value as string | number | boolean;
  }
  return out;
}

export function usePrintedTransferLevels(
  filters: PrintedTransferLevelFilters = {},
): UseQueryResult<PrintedTransferLevelPage, ApiError> {
  const api = useApi();
  return useQuery<PrintedTransferLevelPage, ApiError>({
    queryKey: qk.printedTransfers.levels(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<PrintedTransferLevelPage>(`${ROOT}/levels`, {
        query: pruneUndefined({
          q: filters.q,
          print_design_id: filters.print_design_id,
          side: filters.side,
          low_stock_only: filters.low_stock_only,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function usePrintedTransferMovements(
  filters: PrintedMovementFilters = {},
): UseQueryResult<PrintedMovementPage, ApiError> {
  const api = useApi();
  return useQuery<PrintedMovementPage, ApiError>({
    queryKey: qk.printedTransfers.movements(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<PrintedMovementPage>(`${ROOT}/movements`, {
        query: pruneUndefined({
          printed_transfer_id: filters.printed_transfer_id,
          print_design_id: filters.print_design_id,
          side: filters.side,
          kind: filters.kind,
          date_from: filters.date_from,
          date_to: filters.date_to,
          page: filters.page,
          page_size: filters.page_size,
        }),
      }),
  });
}

export function useCreatePrintedMovement() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintedMovementRead, ApiError, PrintedMovementCreate>({
    mutationFn: (payload) => api.post<PrintedMovementRead>(`${ROOT}/movements`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.printedTransfers.all() }),
  });
}

export function useCreatePrintedTransfer() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintedTransferLevelRead, ApiError, PrintedTransferCreate>({
    mutationFn: (payload) => api.post<PrintedTransferLevelRead>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.printedTransfers.all() }),
  });
}
