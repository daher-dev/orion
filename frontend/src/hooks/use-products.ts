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
  Product,
  ProductCreate,
  ProductFilters,
  ProductPage,
  ProductUpdate,
} from "@/lib/schemas/product";

const buildQuery = (filters: ProductFilters | undefined) => {
  if (!filters) return undefined;
  const query: Record<string, string> = {};
  if (filters.q) query.q = filters.q;
  if (filters.product_type) query.product_type = filters.product_type;
  if (filters.spec_id) query.spec_id = filters.spec_id;
  if (filters.print_id) query.print_id = filters.print_id;
  if (filters.page) query.page = String(filters.page);
  if (filters.page_size) query.page_size = String(filters.page_size);
  return Object.keys(query).length > 0 ? query : undefined;
};

export function useProducts(filters?: ProductFilters): UseQueryResult<ProductPage, ApiError> {
  const api = useApi();
  return useQuery<ProductPage, ApiError>({
    queryKey: qk.products.list(filters ?? {}),
    queryFn: () => api.get<ProductPage>("/v1/products", { query: buildQuery(filters) }),
  });
}

export function useProduct(id: string | null | undefined): UseQueryResult<Product, ApiError> {
  const api = useApi();
  return useQuery<Product, ApiError>({
    queryKey: qk.products.detail(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<Product>(`/v1/products/${id}`),
  });
}

export function useCreateProduct() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Product, ApiError, ProductCreate>({
    mutationFn: (payload) => api.post<Product>("/v1/products", payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.products.lists() });
      qc.setQueryData(qk.products.detail(data.id), data);
    },
  });
}

export function useUpdateProduct() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<Product, ApiError, { id: string; payload: ProductUpdate }>({
    mutationFn: ({ id, payload }) => api.patch<Product>(`/v1/products/${id}`, payload),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: qk.products.lists() });
      qc.setQueryData(qk.products.detail(vars.id), data);
    },
  });
}

export function useDeleteProduct() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products.lists() });
    },
  });
}
