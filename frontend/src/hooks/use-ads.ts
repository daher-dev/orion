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
  Ad,
  AdFilters,
  AdFormPayload,
  AdPage,
} from "@/lib/schemas/ad";

const ROOT = "/v1/ads";

const buildQuery = (filters: AdFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.ecommerce) query.ecommerce = filters.ecommerce;
  if (filters.product_id) query.product_id = filters.product_id;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useAds(
  filters?: AdFilters,
): UseQueryResult<AdPage, ApiError> {
  const api = useApi();
  return useQuery<AdPage, ApiError>({
    queryKey: qk.ads.list(filters ?? {}),
    queryFn: () => api.get<AdPage>(ROOT, { query: buildQuery(filters) }),
  });
}

export function useAd(id: string | null): UseQueryResult<Ad, ApiError> {
  const api = useApi();
  return useQuery<Ad, ApiError>({
    queryKey: qk.ads.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Ad>(`${ROOT}/${id}`),
  });
}

export function useCreateAd() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Ad, ApiError, AdFormPayload>({
    mutationFn: (payload) => api.post<Ad>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.ads.all() }),
  });
}

export function useUpdateAd() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Ad, ApiError, { id: string; payload: Partial<AdFormPayload> }>({
    mutationFn: ({ id, payload }) => api.patch<Ad>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.ads.all() });
      qc.invalidateQueries({ queryKey: qk.ads.detail(vars.id) });
    },
  });
}

export function useDeleteAd() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.ads.all() }),
  });
}
