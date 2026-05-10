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
import type { Print, PrintFilters, PrintPage, PrintFormPayload } from "@/lib/schemas/print";

const buildQuery = (filters: PrintFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function usePrints(filters?: PrintFilters): UseQueryResult<PrintPage, ApiError> {
  const api = useApi();
  return useQuery<PrintPage, ApiError>({
    queryKey: qk.prints.list(filters ?? {}),
    queryFn: () => api.get<PrintPage>("/v1/prints", { query: buildQuery(filters) }),
  });
}

export function usePrint(id: string | null): UseQueryResult<Print, ApiError> {
  const api = useApi();
  return useQuery<Print, ApiError>({
    queryKey: qk.prints.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Print>(`/v1/prints/${id}`),
  });
}

export function useCreatePrint() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Print, ApiError, PrintFormPayload>({
    mutationFn: (payload) => api.post<Print>("/v1/prints", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.prints.lists() });
    },
  });
}

export function useUpdatePrint() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Print, ApiError, { id: string; payload: Partial<PrintFormPayload> }>({
    mutationFn: ({ id, payload }) => api.patch<Print>(`/v1/prints/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.prints.lists() });
      qc.invalidateQueries({ queryKey: qk.prints.detail(vars.id) });
    },
  });
}

export function useDeletePrint() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/prints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.prints.lists() });
    },
  });
}
