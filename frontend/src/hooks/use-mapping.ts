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
  AcceptAllResult,
  MappingFilters,
  MappingItem,
  MappingItemsResponse,
  SetVariationPayload,
} from "@/lib/schemas/mapping";

const ROOT = "/v1/mapping";

const buildQuery = (filters: MappingFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.filter) query.filter = filters.filter;
  if (filters.q) query.q = filters.q;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

/** List De/Para rows (pending|linked|all) with embedded suggestions + progress. */
export function useMappingItems(
  filters?: MappingFilters,
): UseQueryResult<MappingItemsResponse, ApiError> {
  const api = useApi();
  return useQuery<MappingItemsResponse, ApiError>({
    queryKey: qk.mapping.list(filters ?? {}),
    queryFn: () =>
      api.get<MappingItemsResponse>(`${ROOT}/items`, { query: buildQuery(filters) }),
  });
}

/** Mapping a row touches orders + stock, so invalidate those caches too. */
function useInvalidateMapping() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.mapping.all() });
    qc.invalidateQueries({ queryKey: qk.orders.all() });
    qc.invalidateQueries({ queryKey: qk.stock.all() });
  };
}

/** Accept the system's best suggestion for a single pending item. */
export function useAcceptSuggestion() {
  const api = useApi();
  const invalidate = useInvalidateMapping();
  return useMutation<MappingItem, ApiError, string>({
    mutationFn: (itemId) =>
      api.post<MappingItem>(`${ROOT}/items/${itemId}/accept`, {}),
    onSuccess: invalidate,
  });
}

/** Accept every unambiguous suggestion across all pending items. */
export function useAcceptAll() {
  const api = useApi();
  const invalidate = useInvalidateMapping();
  return useMutation<AcceptAllResult, ApiError, void>({
    mutationFn: () => api.post<AcceptAllResult>(`${ROOT}/accept-all`, {}),
    onSuccess: invalidate,
  });
}

/** Manually set (swap) the variation for an item — the De/Para override. */
export function useSetVariation() {
  const api = useApi();
  const invalidate = useInvalidateMapping();
  return useMutation<
    MappingItem,
    ApiError,
    { itemId: string; payload: SetVariationPayload }
  >({
    mutationFn: ({ itemId, payload }) =>
      api.post<MappingItem>(`${ROOT}/items/${itemId}/variation`, payload),
    onSuccess: invalidate,
  });
}
