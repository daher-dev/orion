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
  PrintOrder,
  PrintOrderCompletePayload,
  PrintOrderCreatePayload,
  PrintOrderFilters,
  PrintOrderPage,
  PrintOrderUpdatePayload,
} from "@/lib/schemas/print-order";

const ROOT = "/v1/print-orders";

const buildQuery = (filters: PrintOrderFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.status) query.status = filters.status;
  if (filters.print_design_id) query.print_design_id = filters.print_design_id;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function usePrintOrders(
  filters?: PrintOrderFilters,
): UseQueryResult<PrintOrderPage, ApiError> {
  const api = useApi();
  return useQuery<PrintOrderPage, ApiError>({
    queryKey: qk.printOrders.list(filters ?? {}),
    queryFn: () => api.get<PrintOrderPage>(ROOT, { query: buildQuery(filters) }),
  });
}

export function usePrintOrder(id: string | null): UseQueryResult<PrintOrder, ApiError> {
  const api = useApi();
  return useQuery<PrintOrder, ApiError>({
    queryKey: qk.printOrders.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<PrintOrder>(`${ROOT}/${id}`),
  });
}

export function useCreatePrintOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintOrder, ApiError, PrintOrderCreatePayload>({
    mutationFn: (payload) => api.post<PrintOrder>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.printOrders.all() }),
  });
}

export function useUpdatePrintOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintOrder, ApiError, { id: string; payload: PrintOrderUpdatePayload }>({
    mutationFn: ({ id, payload }) => api.patch<PrintOrder>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.printOrders.all() });
      qc.invalidateQueries({ queryKey: qk.printOrders.detail(vars.id) });
    },
  });
}

/**
 * "Lançar impressos" — the T4 posting action. Completing the order debits the
 * attached paper roll's meters and credits printed transfers (per side). Both
 * downstream views must refresh, so we invalidate printed-transfers + paper
 * rolls alongside the print-order caches.
 */
export function useCompletePrintOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrintOrder, ApiError, { id: string; payload?: PrintOrderCompletePayload }>({
    mutationFn: ({ id, payload }) =>
      api.post<PrintOrder>(`${ROOT}/${id}/complete`, payload ?? {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.printOrders.all() });
      qc.invalidateQueries({ queryKey: qk.printOrders.detail(vars.id) });
      qc.invalidateQueries({ queryKey: qk.printedTransfers.all() });
      qc.invalidateQueries({ queryKey: qk.paperRolls.all() });
    },
  });
}
