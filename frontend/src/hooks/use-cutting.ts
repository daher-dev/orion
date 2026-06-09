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
  CuttingCreatePayload,
  CuttingFilters,
  CuttingOrder,
  CuttingPage,
  CuttingRunCost,
  CuttingStatus,
} from "@/lib/schemas/cutting";

const ROOT = "/v1/cutting";

const buildQuery = (filters: CuttingFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.status) query.status = filters.status;
  if (filters.product_id) query.product_id = filters.product_id;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useCuttingOrders(
  filters?: CuttingFilters,
): UseQueryResult<CuttingPage, ApiError> {
  const api = useApi();
  return useQuery<CuttingPage, ApiError>({
    queryKey: qk.cutting.list(filters ?? {}),
    queryFn: () => api.get<CuttingPage>(ROOT, { query: buildQuery(filters) }),
  });
}

export function useCuttingOrder(id: string | null): UseQueryResult<CuttingOrder, ApiError> {
  const api = useApi();
  return useQuery<CuttingOrder, ApiError>({
    queryKey: qk.cutting.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<CuttingOrder>(`${ROOT}/${id}`),
  });
}

/**
 * Frozen per-run production cost for one cutting order. Only fetched when
 * the order is `done` (the cost row is computed on the DONE transition); a
 * 404 means "not yet computed" — we don't retry it, and the consuming
 * component renders nothing in that case.
 */
export function useCuttingCost(
  id: string | null,
  status: CuttingStatus | undefined,
): UseQueryResult<CuttingRunCost, ApiError> {
  const api = useApi();
  return useQuery<CuttingRunCost, ApiError>({
    queryKey: qk.cutting.cost(id ?? ""),
    enabled: !!id && status === "done",
    retry: false,
    queryFn: () => api.get<CuttingRunCost>(`${ROOT}/${id}/cost`),
  });
}

export function useCreateCuttingOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<CuttingOrder, ApiError, CuttingCreatePayload>({
    mutationFn: (payload) => api.post<CuttingOrder>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.cutting.all() }),
  });
}

export type CuttingUpdatePayload = {
  status?: CuttingStatus;
  actual_outputs?: Array<{ size: string; quantity: number }>;
  cut_at?: string;
};

export function useUpdateCuttingOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<CuttingOrder, ApiError, { id: string; payload: CuttingUpdatePayload }>({
    mutationFn: ({ id, payload }) => api.patch<CuttingOrder>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.cutting.all() });
      qc.invalidateQueries({ queryKey: qk.cutting.detail(vars.id) });
      qc.invalidateQueries({ queryKey: qk.cutting.cost(vars.id) });
    },
  });
}

export function useDeleteCuttingOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.cutting.all() }),
  });
}
