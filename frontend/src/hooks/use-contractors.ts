"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import type {
  Contractor,
  ContractorFilters,
  ContractorFormPayload,
  ContractorPage,
} from "@/lib/schemas/contractor";

const ROOT = "/v1/contractors";

export function useContractors(
  filters: ContractorFilters = {},
): UseQueryResult<ContractorPage, ApiError> {
  const api = useApi();
  return useQuery<ContractorPage, ApiError>({
    queryKey: qk.contractors.list(filters as Readonly<Record<string, unknown>>),
    queryFn: () =>
      api.get<ContractorPage>(ROOT, {
        query: {
          q: filters.q,
          page: filters.page,
          page_size: filters.page_size,
        },
      }),
  });
}

export function useContractor(id: string | null): UseQueryResult<Contractor, ApiError> {
  const api = useApi();
  return useQuery<Contractor, ApiError>({
    queryKey: qk.contractors.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Contractor>(`${ROOT}/${id}`),
  });
}

export function useCreateContractor() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Contractor, ApiError, ContractorFormPayload>({
    mutationFn: (payload) => api.post<Contractor>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.contractors.all() }),
  });
}

export function useUpdateContractor() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Contractor, ApiError, { id: string; payload: ContractorFormPayload }>({
    mutationFn: ({ id, payload }) => api.patch<Contractor>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.contractors.all() });
      qc.invalidateQueries({ queryKey: qk.contractors.detail(variables.id) });
    },
  });
}

export function useDeleteContractor() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.contractors.all() }),
  });
}
