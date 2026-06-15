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
  BatchCreatePayload,
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

export function useBatch(id: string | null): UseQueryResult<Batch, ApiError> {
  const api = useApi();
  return useQuery<Batch, ApiError>({
    queryKey: qk.batches.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Batch>(`${ROOT}/${id}`),
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
