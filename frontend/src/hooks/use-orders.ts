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
  Order,
  OrderCreatePayload,
  OrderFilters,
  OrderPage,
  OrderStatus,
} from "@/lib/schemas/order";

const ROOT = "/v1/orders";

const buildQuery = (filters: OrderFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.status) query.status = filters.status;
  if (filters.channel) query.channel = filters.channel;
  if (filters.client_id) query.client_id = filters.client_id;
  if (filters.ad_id) query.ad_id = filters.ad_id;
  if (filters.date_from) query.date_from = filters.date_from;
  if (filters.date_to) query.date_to = filters.date_to;
  if (filters.unbatched) query.unbatched = "true";
  if (filters.batch_id) query.batch_id = filters.batch_id;
  if (filters.product_id) query.product_id = filters.product_id;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useOrders(
  filters?: OrderFilters,
): UseQueryResult<OrderPage, ApiError> {
  const api = useApi();
  return useQuery<OrderPage, ApiError>({
    queryKey: qk.orders.list(filters ?? {}),
    queryFn: () => api.get<OrderPage>(ROOT, { query: buildQuery(filters) }),
  });
}

export function useOrder(id: string | null): UseQueryResult<Order, ApiError> {
  const api = useApi();
  return useQuery<Order, ApiError>({
    queryKey: qk.orders.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Order>(`${ROOT}/${id}`),
  });
}

export function useCreateOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Order, ApiError, OrderCreatePayload>({
    mutationFn: (payload) => api.post<Order>(ROOT, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders.all() }),
  });
}

export type OrderUpdatePayload = {
  status?: OrderStatus;
  sale_price?: string;
  ordered_at?: string;
  external_order_id?: string;
  quantity?: number;
};

export function useUpdateOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<
    Order,
    ApiError,
    { id: string; payload: OrderUpdatePayload }
  >({
    mutationFn: ({ id, payload }) => api.patch<Order>(`${ROOT}/${id}`, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.orders.all() });
      qc.invalidateQueries({ queryKey: qk.orders.detail(vars.id) });
    },
  });
}

export function useTransitionOrderStatus() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<
    Order,
    ApiError,
    { id: string; status: OrderStatus }
  >({
    mutationFn: ({ id, status }) =>
      api.post<Order>(`${ROOT}/${id}/status`, { status }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.orders.all() });
      qc.invalidateQueries({ queryKey: qk.orders.detail(vars.id) });
      // Stock changes when shipped/returned — invalidate the stock keys
      // so other panes pick up the new movements.
      qc.invalidateQueries({ queryKey: qk.stock.all() });
    },
  });
}

export function useDeleteOrder() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`${ROOT}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orders.all() }),
  });
}
