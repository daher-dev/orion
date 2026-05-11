/**
 * Hook tests for the Products feature — mocks `useApi` so we don't need MSW.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { createElement } from "react";

const apiSpy = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@/hooks/use-api", () => ({
  useApi: () => apiSpy,
}));

import {
  useCreateProduct,
  useDeleteProduct,
  useProduct,
  useProducts,
  useUpdateProduct,
} from "../use-products";

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  apiSpy.get.mockReset();
  apiSpy.post.mockReset();
  apiSpy.patch.mockReset();
  apiSpy.delete.mockReset();
});

describe("useProducts", () => {
  it("hits /v1/products with no query when no filters", async () => {
    apiSpy.get.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      has_more: false,
    });
    const { result } = renderHook(() => useProducts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith("/v1/products", { query: undefined });
  });

  it("forwards filters as query params", async () => {
    apiSpy.get.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      has_more: false,
    });
    const { result } = renderHook(
      () =>
        useProducts({
          q: "crop",
          product_type: "tshirt",
          spec_id: "spec-1",
          print_id: "print-1",
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith("/v1/products", {
      query: expect.objectContaining({
        q: "crop",
        product_type: "tshirt",
        spec_id: "spec-1",
        print_id: "print-1",
      }),
    });
  });
});

describe("useProduct (detail)", () => {
  it("does not fire when id is missing", () => {
    const { result } = renderHook(() => useProduct(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiSpy.get).not.toHaveBeenCalled();
  });

  it("fetches /v1/products/{id} when id is provided", async () => {
    apiSpy.get.mockResolvedValueOnce({ id: "abc" });
    const { result } = renderHook(() => useProduct("abc"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith("/v1/products/abc");
  });
});

describe("useCreateProduct", () => {
  it("POSTs payload to /v1/products", async () => {
    apiSpy.post.mockResolvedValueOnce({ id: "abc" });
    const { result } = renderHook(() => useCreateProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        name: "Cropped",
        product_type: "tshirt",
        spec_id: "spec-1",
        print_id: null,
        variations: [{ size: "m", color: "Preto", color_code: "PRT" }],
      });
    });
    expect(apiSpy.post).toHaveBeenCalledWith(
      "/v1/products",
      expect.objectContaining({ name: "Cropped" }),
    );
  });
});

describe("useUpdateProduct", () => {
  it("PATCHes /v1/products/{id}", async () => {
    apiSpy.patch.mockResolvedValueOnce({ id: "abc" });
    const { result } = renderHook(() => useUpdateProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "abc", payload: { name: "X" } });
    });
    expect(apiSpy.patch).toHaveBeenCalledWith(
      "/v1/products/abc",
      expect.objectContaining({ name: "X" }),
    );
  });
});

describe("useDeleteProduct", () => {
  it("DELETEs /v1/products/{id}", async () => {
    apiSpy.delete.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteProduct(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("abc");
    });
    expect(apiSpy.delete).toHaveBeenCalledWith("/v1/products/abc");
  });
});
