"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  Batch,
  BatchAssemblePayload,
  BatchAssembleResult,
  BatchCreatePayload,
  BatchDetail,
  BatchFilters,
  BatchPage,
  BatchStatus,
} from "@/lib/schemas/batch";

const ROOT = "/v1/batches";

const buildQuery = (filters: BatchFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.status) query.status = filters.status;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useBatches(
  filters?: BatchFilters,
): UseQueryResult<BatchPage, ApiError> {
  const api = useApi();
  return useQuery<BatchPage, ApiError>({
    queryKey: qk.batches.list(filters ?? {}),
    queryFn: () => api.get<BatchPage>(ROOT, { query: buildQuery(filters) }),
  });
}

/**
 * Single batch (Lote) detail. `GET /v1/batches/{id}` returns the richer
 * `BatchDetailRead` shape — the lean fields plus the computed per-estampa grid
 * and roll-ups (`orders_ready`, `to_print_total`, `needs_assembly`, `can_ship`).
 */
export function useBatchDetail(
  id: string | null,
): UseQueryResult<BatchDetail, ApiError> {
  const api = useApi();
  return useQuery<BatchDetail, ApiError>({
    queryKey: qk.batches.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<BatchDetail>(`${ROOT}/${id}`),
  });
}

export function useCreateBatch() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Batch, ApiError, BatchCreatePayload>({
    mutationFn: (payload) => api.post<Batch>(ROOT, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.batches.all() });
      // Orders now carry a batch_id; refresh the orders list too.
      qc.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}

export function useTransitionBatch() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Batch, ApiError, { id: string; status: BatchStatus }>({
    mutationFn: ({ id, status }) =>
      api.post<Batch>(`${ROOT}/${id}/status`, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.batches.all() });
      qc.invalidateQueries({ queryKey: qk.batches.detail(vars.id) });
    },
  });
}

export function useDeleteBatch() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`${ROOT}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.batches.all() });
      qc.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}

/**
 * Montar o lote — bulk-assemble the SKUs the batch is short on (reuses T5).
 * Debits blank pieces + printed transfers, credits finished product. Touches
 * every WIP tier, so invalidate them all (the grid `montado` rises).
 */
export function useAssembleBatch() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<
    BatchAssembleResult,
    ApiError,
    { id: string; payload?: BatchAssemblePayload }
  >({
    mutationFn: ({ id, payload }) =>
      api.post<BatchAssembleResult>(`${ROOT}/${id}/assemble`, payload ?? {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.batches.detail(vars.id) });
      qc.invalidateQueries({ queryKey: qk.batches.all() });
      qc.invalidateQueries({ queryKey: qk.stock.all() });
      qc.invalidateQueries({ queryKey: qk.blankStock.all() });
      qc.invalidateQueries({ queryKey: qk.printedTransfers.all() });
      qc.invalidateQueries({ queryKey: qk.orders.all() });
    },
  });
}

/**
 * Enviar o lote — ship the batch's orders (T6) and set status `dispatched`.
 * Readiness-gated server-side (409 if any member order isn't in finished
 * stock). Writes a finished-stock exit per order, so invalidate stock + orders.
 */
export function useShipBatch() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<BatchDetail, ApiError, string>({
    mutationFn: (id) => api.post<BatchDetail>(`${ROOT}/${id}/ship`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.batches.detail(id) });
      qc.invalidateQueries({ queryKey: qk.batches.all() });
      qc.invalidateQueries({ queryKey: qk.orders.all() });
      qc.invalidateQueries({ queryKey: qk.stock.all() });
    },
  });
}
