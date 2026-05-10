"use client";

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type {
  SpecCreate,
  SpecFilters,
  SpecPage,
  SpecRead,
  SpecUpdate,
} from "@/lib/schemas/spec";

export type SpecsListParams = {
  filters?: SpecFilters;
  page?: number;
  page_size?: number;
};

function buildQuery(params: SpecsListParams | undefined) {
  if (!params) return {} as Record<string, string | number>;
  const out: Record<string, string | number> = {};
  if (params.page) out.page = params.page;
  if (params.page_size) out.page_size = params.page_size;
  if (params.filters?.q) out.q = params.filters.q;
  if (params.filters?.fabric_type) out.fabric_type = params.filters.fabric_type;
  return out;
}

export function useSpecs(params?: SpecsListParams): UseQueryResult<SpecPage, ApiError> {
  const api = useApi();
  return useQuery<SpecPage, ApiError>({
    queryKey: qk.specs.list({
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 50,
      ...(params?.filters ?? {}),
    }),
    queryFn: () => api.get<SpecPage>("/v1/specs", { query: buildQuery(params) }),
  });
}

export function useSpec(id: string | undefined): UseQueryResult<SpecRead, ApiError> {
  const api = useApi();
  return useQuery<SpecRead, ApiError>({
    queryKey: qk.specs.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<SpecRead>(`/v1/specs/${id}`),
  });
}

export function useCreateSpec() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<SpecRead, ApiError, SpecCreate>({
    mutationFn: (payload) => api.post<SpecRead>("/v1/specs", payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.specs.lists() });
      qc.setQueryData(qk.specs.detail(data.id), data);
    },
  });
}

export function useUpdateSpec(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<SpecRead, ApiError, SpecUpdate>({
    mutationFn: (payload) => api.patch<SpecRead>(`/v1/specs/${id}`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.specs.lists() });
      qc.setQueryData(qk.specs.detail(data.id), data);
    },
  });
}

export function useDeleteSpec() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/specs/${id}`),
    onSuccess: (_void, id) => {
      qc.invalidateQueries({ queryKey: qk.specs.lists() });
      qc.removeQueries({ queryKey: qk.specs.detail(id) });
    },
  });
}

/**
 * Fetch every spec across pages — for consumers (Product create form, etc.)
 * that need the full set without paginating manually. Caps at 500 specs.
 */
export function useSpecsList(): UseQueryResult<SpecRead[], ApiError> {
  const api = useApi();
  return useQuery<SpecRead[], ApiError>({
    queryKey: qk.specs.list({ all: true }),
    queryFn: async () => {
      const all: SpecRead[] = [];
      let page = 1;
      const pageSize = 100;
      while (page <= 5) {
        const data = await api.get<SpecPage>("/v1/specs", {
          query: { page, page_size: pageSize },
        });
        all.push(...data.items);
        if (!data.has_more) break;
        page += 1;
      }
      return all;
    },
  });
}
