/**
 * Hook tests for the Specs feature. We mock the underlying ApiClient by
 * intercepting `useApi` so we never have to spin up MSW for these unit-level
 * checks. Network-shape correctness is the responsibility of E2E.
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

import { useSpecs, useSpec, useCreateSpec, useUpdateSpec, useDeleteSpec } from "../use-specs";

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

describe("useSpecs (list)", () => {
  it("calls /v1/specs with no query when no filters", async () => {
    apiSpy.get.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
    const { result } = renderHook(() => useSpecs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith("/v1/specs", { query: {} });
  });

  it("forwards q + fabric_type filters as query params", async () => {
    apiSpy.get.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 50, has_more: false });
    const { result } = renderHook(
      () => useSpecs({ filters: { q: "crop", fabric_type: "jersey" } }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith("/v1/specs", {
      query: expect.objectContaining({ q: "crop", fabric_type: "jersey" }),
    });
  });
});

describe("useSpec (detail)", () => {
  it("doesn't fire when id is undefined", async () => {
    const { result } = renderHook(() => useSpec(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiSpy.get).not.toHaveBeenCalled();
  });

  it("fetches /v1/specs/{id} when id is provided", async () => {
    apiSpy.get.mockResolvedValueOnce({ id: "abc", code: "C", name: "N" });
    const { result } = renderHook(() => useSpec("abc"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSpy.get).toHaveBeenCalledWith("/v1/specs/abc");
  });
});

describe("useCreateSpec", () => {
  it("POSTs payload to /v1/specs", async () => {
    apiSpy.post.mockResolvedValueOnce({ id: "abc" });
    const { result } = renderHook(() => useCreateSpec(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        code: "C",
        name: "N",
        fabric_type: "jersey",
        fabric_grammage_gsm: 180,
        fabric_weight_per_piece_g: "250",
        has_ribana: false,
        ribana_weight_pct: null,
        labor_cost: "12",
        sale_price: null,
        notes: null,
        trims: [],
      });
    });
    expect(apiSpy.post).toHaveBeenCalledWith("/v1/specs", expect.objectContaining({ code: "C" }));
  });
});

describe("useUpdateSpec", () => {
  it("PATCHes /v1/specs/{id}", async () => {
    apiSpy.patch.mockResolvedValueOnce({ id: "xyz" });
    const { result } = renderHook(() => useUpdateSpec("xyz"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: "Renamed" });
    });
    expect(apiSpy.patch).toHaveBeenCalledWith("/v1/specs/xyz", { name: "Renamed" });
  });
});

describe("useDeleteSpec", () => {
  it("DELETEs /v1/specs/{id}", async () => {
    apiSpy.delete.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeleteSpec(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("xyz");
    });
    expect(apiSpy.delete).toHaveBeenCalledWith("/v1/specs/xyz");
  });
});
